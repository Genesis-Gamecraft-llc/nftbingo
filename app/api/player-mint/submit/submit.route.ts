import "server-only";

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Connection, Commitment, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getUmiPlayerServer } from "@/lib/solana/umi.server";

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
    mintSecretKeyB64: string;
  }>;
};


function keypairFromUmiIdentity() {
  const umi = getUmiPlayerServer();
  const sk = (umi.identity as any)?.secretKey;
  if (!sk) throw new Error("Server identity missing secretKey in umi.identity");
  // sk may be a Uint8Array already
  const secret = sk instanceof Uint8Array ? sk : Uint8Array.from(sk);
  return Keypair.fromSecretKey(secret);
}
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
    const serverIdentityKp = keypairFromUmiIdentity();

    const results: Array<{ i: number; ok: boolean; signature?: string; error?: string }> = [];

    for (let i = 0; i < signedTxBase64s.length; i++) {
      try {
        let txBytes = Buffer.from(String(signedTxBase64s[i] || ""), "base64");
        // IMPORTANT: Wallet signs first (client). Server adds required signatures (mint + update authority) here.
        const mintRec = attempt.mints[i] || attempt.mints[0];
        if (!mintRec?.mintSecretKeyB64) throw new Error("Missing mint secret for attempt");
        const mintKp = Keypair.fromSecretKey(Buffer.from(mintRec.mintSecretKeyB64, "base64"));
        try {
          const vtx = VersionedTransaction.deserialize(txBytes);
          vtx.sign([serverIdentityKp, mintKp]);
          txBytes = Buffer.from(vtx.serialize());
        } catch {
          const tx = Transaction.from(txBytes);
          tx.partialSign(serverIdentityKp, mintKp);
          txBytes = Buffer.from(tx.serialize());
        }
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
