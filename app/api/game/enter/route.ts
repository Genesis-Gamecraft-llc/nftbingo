import { NextResponse } from "next/server";
import { loadState, saveState } from "../_store";
import { verifySolTransferTx } from "../_verifySolTx";

export const runtime = "nodejs";

const USED_SIG_PREFIX = "nftbingo:usedSig:";

function getUpstashRestUrl() {
  return process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim() || "";
}
function getUpstashRestToken() {
  return process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim() || "";
}
function hasUpstash() {
  return Boolean(getUpstashRestUrl() && getUpstashRestToken());
}

async function upstashPipeline(commands: Array<Array<string>>) {
  const url = getUpstashRestUrl();
  const token = getUpstashRestToken();

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof data === "object" && data ? JSON.stringify(data).slice(0, 300) : "no-json";
    throw new Error(`Upstash error (${res.status}): ${detail}`);
  }
  return data as Array<{ result: any; error?: any }>;
}

async function markSignatureUsed(sig: string) {
  if (!hasUpstash()) return;
  const key = `${USED_SIG_PREFIX}${sig}`;
  const out = await upstashPipeline([["SETNX", key, "1"]]);
  const ok = out?.[0]?.result;
  if (ok !== 1) throw new Error("This transaction signature was already used.");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const wallet = String(body?.wallet || "");
  const signature = String(body?.signature || "");
  const totalSol = Number(body?.totalSol);
  const cardIds = Array.isArray(body?.cardIds) ? body.cardIds.map((x: any) => String(x)) : [];

  if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  if (!Number.isFinite(totalSol) || !(totalSol > 0)) return NextResponse.json({ error: "Invalid totalSol" }, { status: 400 });
  if (cardIds.length === 0) return NextResponse.json({ error: "No cards" }, { status: 400 });

  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  const pot = process.env.NEXT_PUBLIC_GAME_POT_WALLET?.trim();
  if (!rpcUrl) return NextResponse.json({ error: "Missing NEXT_PUBLIC_SOLANA_RPC_URL" }, { status: 500 });
  if (!pot) return NextResponse.json({ error: "Missing NEXT_PUBLIC_GAME_POT_WALLET" }, { status: 500 });

  const state = await loadState();

  if (state.status !== "OPEN") {
    return NextResponse.json({ error: "Entries are not open" }, { status: 400 });
  }

  // One paid entry bundle per wallet per game (MVP)
  if ((state.entries || []).some((e) => e.wallet === wallet)) {
    return NextResponse.json({ error: "This wallet already entered this game" }, { status: 400 });
  }

  // Prevent same card from being entered twice across wallets for this game
  const existing = new Set((state.entries || []).flatMap((e) => e.cardIds || []));
  for (const id of cardIds) {
    if (existing.has(id)) return NextResponse.json({ error: "One or more cards already entered this game" }, { status: 400 });
  }

  const expectedSol = (state.entryFeeSol || 0) * cardIds.length;
  const expectedLamports = Math.round(expectedSol * 1_000_000_000);

  if (Math.abs(expectedSol - totalSol) > 0.00001) {
    return NextResponse.json({ error: "totalSol does not match entry fee" }, { status: 400 });
  }

  // Verify payment first
  await verifySolTransferTx({
    rpcUrl,
    signature,
    expectedFrom: wallet,
    expectedTo: pot,
    minLamports: expectedLamports,
  });

  // Prevent replay
  await markSignatureUsed(signature);

  state.entries = state.entries || [];
  state.entries.push({ wallet, cardIds, signature, totalSol, ts: Date.now() });

  const saved = await saveState(state);
  const { buildStateResponse } = await import("../_stateResponse");
  return NextResponse.json(await buildStateResponse(saved, wallet), { headers: { "Cache-Control": "no-store" } });
}
