import "server-only";

import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Connection, Commitment, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitRequest = {
  attemptId: string;
  signedTxBase64s: string[];
};

type AttemptRecord = {
  attemptId: string;
  buildId: string;
  wallet: string;
  createdAt: number;
  mints: Array<{
    index: number;
    serialStr: string;
    mint: string;
    imageUri: string;
    metadataUri: string;
    txBase64: string;
    // Stored by /build so /submit can add remaining required signatures (mint + authority)
    mintSecretKeyB64?: string;
  }>;
};

const CONFIRM_COMMITMENT: Commitment = "confirmed";

function attemptKey(attemptId: string) {
  return `player:attempt:${attemptId}`;
}

function getConnection() {
  const rpc = process.env.SOLANA_RPC_URL?.trim();
  if (!rpc) throw new Error("Missing SOLANA_RPC_URL env var");
  return new Connection(rpc, CONFIRM_COMMITMENT);
}

function loadPlayerAuthorityKeypair(): Keypair {
  // Keep the same naming convention used in umi.server.ts
  const jsonVar = "PLAYER_SOLANA_KEYPAIR_JSON";
  const pathVar = "PLAYER_SOLANA_KEYPAIR_PATH";

  const json = process.env[jsonVar]?.trim();
  if (json) {
    const secret = Uint8Array.from(JSON.parse(json));
    return Keypair.fromSecretKey(secret);
  }

  const p = process.env[pathVar]?.trim();
  if (p) {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    const raw = fs.readFileSync(abs, "utf8");
    const secret = Uint8Array.from(JSON.parse(raw));
    return Keypair.fromSecretKey(secret);
  }

  throw new Error(`Missing ${jsonVar} or ${pathVar}`);
}

function decodeKeypairFromB64(b64: string): Keypair {
  const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
  return Keypair.fromSecretKey(bytes);
}

function tryDeserializeAndSign(
  txBytes: Uint8Array,
  signers: Keypair[]
): { signedBytes: Uint8Array } {
  // Support both v0 (versioned) and legacy transactions
  try {
    const vtx = VersionedTransaction.deserialize(txBytes);
    vtx.sign(signers);
    return { signedBytes: vtx.serialize() };
  } catch {
    const tx = Transaction.from(txBytes);
    for (const kp of signers) tx.partialSign(kp);
    return { signedBytes: tx.serialize() };
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubmitRequest;

    const attemptId = String(body.attemptId || "").trim();
    const signedTxBase64s = Array.isArray(body.signedTxBase64s) ? body.signedTxBase64s : [];

    if (!attemptId || signedTxBase64s.length < 1) {
      return NextResponse.json({ ok: false, error: "Missing attemptId or signedTxBase64s" }, { status: 400 });
    }

    const attempt = (await kv.get<AttemptRecord>(attemptKey(attemptId))) ?? null;
    if (!attempt) return NextResponse.json({ ok: false, error: "Attempt not found or expired" }, { status: 404 });

    const conn = getConnection();

    // IMPORTANT:
    // /build intentionally returns a tx with the wallet as fee payer but WITHOUT the server/mint signatures,
    // so the client gets ONE wallet prompt (fee payer signature) and we add the remaining signatures here.
    const authorityKp = loadPlayerAuthorityKeypair();

    const results: Array<{ i: number; ok: boolean; signature?: string; error?: string }> = [];

    for (let i = 0; i < signedTxBase64s.length; i++) {
      try {
        const txB64 = String(signedTxBase64s[i] || "");
        if (!txB64) throw new Error("Missing signedTxBase64");

        const mintRec = attempt.mints?.[i];
        const mintSkB64 = mintRec?.mintSecretKeyB64;
        if (!mintSkB64) throw new Error("Missing mint secret key for this attempt (mintSecretKeyB64)");

        const mintKp = decodeKeypairFromB64(mintSkB64);

        const clientSignedBytes = Uint8Array.from(Buffer.from(txB64, "base64"));

        // Add the mint + authority signatures required by createNft / verifyCollection.
        const { signedBytes } = tryDeserializeAndSign(clientSignedBytes, [mintKp, authorityKp]);

        const sig = await conn.sendRawTransaction(Buffer.from(signedBytes), { skipPreflight: false, maxRetries: 5 });
        const conf = await conn.confirmTransaction(sig, CONFIRM_COMMITMENT);

        if (conf.value.err) throw new Error(JSON.stringify(conf.value.err));
        results.push({ i, ok: true, signature: sig });
      } catch (e: any) {
        results.push({ i, ok: false, error: e?.message ?? String(e) });
      }
    }

    const firstOk = results.find((r) => r.ok && r.signature)?.signature || "";

    // If everything failed, return ok:false so the client DOES NOT show "Mint successful".
    if (!firstOk) {
      const firstErr = results.find((r) => !r.ok)?.error || "Transaction failed";
      return NextResponse.json({ ok: false, error: firstErr, results }, { status: 500 });
    }

    // Convenience fields for the client
    return NextResponse.json({ ok: true, signature: firstOk, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Submit error" }, { status: 500 });
  }
}
