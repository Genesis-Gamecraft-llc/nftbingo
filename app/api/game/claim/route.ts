import { NextResponse } from "next/server";
import { loadState, saveState } from "../_store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const wallet = String(body?.wallet || "");
  const cardId = String(body?.cardId || "");

  if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
  if (!cardId) return NextResponse.json({ error: "Missing cardId" }, { status: 400 });

  const state = await loadState();

  if (state.status !== "LOCKED" && state.status !== "PAUSED") {
    return NextResponse.json({ error: "Game is not in a claimable state" }, { status: 400 });
  }

  const entry = state.entries.find((e) => e.wallet === wallet);
  if (!entry || !(entry.cardIds || []).includes(cardId)) {
    return NextResponse.json({ error: "That card is not entered for this wallet" }, { status: 400 });
  }

  if (state.winners?.some((w) => w.cardId === cardId)) {
    return NextResponse.json({ error: "That card already claimed" }, { status: 400 });
  }

  state.winners = state.winners || [];
  state.winners.push({
    cardId,
    wallet,
    isFounders: false,
    ts: Date.now(),
  });

  const next = await saveState(state);

  return NextResponse.json({ ok: true, state: next }, { headers: { "Cache-Control": "no-store" } });
}
