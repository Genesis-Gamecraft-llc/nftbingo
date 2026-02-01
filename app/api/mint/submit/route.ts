// app/api/mint/submit/route.ts
import "server-only";

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Connection, SendOptions, Commitment } from "@solana/web3.js";
import { markSlotMinted } from "@/lib/mint/slots.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitRequest = {
  attemptId: string;
  signedTxBase64: string; // signed by user wallet
};

const CONFIRM_COMMITMENT: Commitment = "confirmed";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getConnection() {
  const rpc = process.env.SOLANA_RPC_URL?.trim();
  if (!rpc) throw new Error("Missing SOLANA_RPC_URL env var");
  // IMPORTANT: we do NOT use websocket subscriptions anywhere in this route
  return new Connection(rpc, CONFIRM_COMMITMENT);
}

function decodeTxBytes(base64: string): Buffer {
  try {
    return Buffer.from(base64, "base64");
  } catch {
    throw new Error("signedTxBase64 is not valid base64");
  }
}

function isRateLimitError(e: any) {
  const msg = String(e?.message ?? "");
  return msg.includes("429") || msg.toLowerCase().includes("too many requests");
}

async function withBackoff<T>(fn: () => Promise<T>, tries = 7): Promise<T> {
  let delay = 600;
  let lastErr: any;

  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      if (!isRateLimitError(e)) throw e;
      await sleep(delay);
      delay = Math.min(delay * 2, 10_000);
    }
  }
  throw lastErr;
}

async function sendWithRetries(
  connection: Connection,
  rawTx: Buffer,
  opts: SendOptions,
  maxAttempts: number
): Promise<string> {
  let lastErr: any = null;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      // sendRawTransaction is HTTP, not pubsub
      return await connection.sendRawTransaction(rawTx, opts);
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? e);

      if (
        msg.toLowerCase().includes("blockhash not found") ||
        msg.toLowerCase().includes("block height exceeded")
      ) {
        throw new Error("BLOCKHASH_EXPIRED");
      }

      if (isRateLimitError(e)) {
        await sleep(Math.min(1500 * (i + 1), 8000));
        continue;
      }

      await sleep(Math.min(500 * (i + 1), 2000));
    }
  }
  throw lastErr ?? new Error("sendRawTransaction failed");
}

async function confirmWithPolling(
  connection: Connection,
  signature: string,
  timeoutMs = 60_000
): Promise<"confirmed" | "timeout"> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = await withBackoff(() =>
      connection.getSignatureStatuses([signature], { searchTransactionHistory: true })
    );

    const s = status?.value?.[0];
    if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
      return "confirmed";
    }

    await sleep(1200);
  }

  return "timeout";
}

export async function POST(req: Request) {
  let lockKey = "";

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<SubmitRequest>;
    const attemptId = String(body?.attemptId || "").trim();
    const signedTxBase64 = String(body?.signedTxBase64 || "").trim();

    if (!attemptId) return NextResponse.json({ ok: false, error: "Missing attemptId" }, { status: 400 });
    if (!signedTxBase64) return NextResponse.json({ ok: false, error: "Missing signedTxBase64" }, { status: 400 });

    const attemptKey = `attempt:${attemptId}`;
    const attempt = await kv.get<any>(attemptKey);
    if (!attempt) return NextResponse.json({ ok: false, error: "Attempt not found" }, { status: 404 });

    // If already submitted, return existing signature
    if (attempt.signature) {
      return NextResponse.json({
        ok: true,
        attemptId,
        signature: attempt.signature,
        status: attempt.status ?? "submitted",
        explorer: `https://explorer.solana.com/tx/${attempt.signature}?cluster=mainnet-beta`,
      });
    }

    // Prevent parallel submit for same attempt
    const lockPrefix = "submitLock:";
    lockKey = `${lockPrefix}${attemptId}`;
    const gotLock = await kv.set(lockKey, "1", { nx: true, ex: 90 });
    if (!gotLock) {
      return NextResponse.json(
        { ok: false, error: "Submit already in progress for this attempt. Please wait." },
        { status: 429 }
      );
    }

    const connection = getConnection();

    const rawTx = decodeTxBytes(signedTxBase64);

    // Send tx
    const sendOpts: SendOptions = {
      skipPreflight: false,
      maxRetries: 0, // we handle retries ourselves
    };

    const signature = await sendWithRetries(connection, rawTx, sendOpts, 5);

    // Confirm by polling
    const result = await confirmWithPolling(connection, signature, 60_000);
    const status = result === "confirmed" ? "confirmed" : "submitted";

    // Mark slot minted
    // (slots.server.ts currently expects only slotId)
    if (attempt.slotId) {
      await markSlotMinted(Number(attempt.slotId));
    }

    attempt.status = status;
    attempt.signature = signature;
    await kv.set(attemptKey, attempt, { ex: 60 * 60 });

    await kv.del(lockKey);

    // ✅ Added: single “mint happened” log line (no behavior changes)
    console.log("[MINT SUCCESS]", {
      attemptId,
      signature,
      status,
      wallet: attempt?.wallet,
      serial: attempt?.serial,
      slotId: attempt?.slotId,
      backgroundId: attempt?.backgroundId,
    });

    return NextResponse.json({
      ok: true,
      attemptId,
      signature,
      status,
      explorer: `https://explorer.solana.com/tx/${signature}?cluster=mainnet-beta`,
    });
  } catch (e: any) {
    if (lockKey) {
      try {
        await kv.del(lockKey);
      } catch {}
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Submit error" }, { status: 500 });
  }
}
