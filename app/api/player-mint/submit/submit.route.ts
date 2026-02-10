import "server-only";

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Connection, Commitment } from "@solana/web3.js";

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

    const results: Array<{ i: number; ok: boolean; signature?: string; error?: string }> = [];

    for (let i = 0; i < signedTxBase64s.length; i++) {
      try {
        const txBytes = Buffer.from(String(signedTxBase64s[i] || ""), "base64");
        const sig = await conn.sendRawTransaction(txBytes, { skipPreflight: false, maxRetries: 3 });
        const conf = await conn.confirmTransaction(sig, CONFIRM_COMMITMENT);
        if (conf.value.err) throw new Error(JSON.stringify(conf.value.err));
        results.push({ i, ok: true, signature: sig });
      } catch (e: any) {
        results.push({ i, ok: false, error: e?.message ?? String(e) });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Submit error" }, { status: 500 });
  }
}
