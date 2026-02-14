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

  // Only claim when game is live (LOCKED). If PAUSED, admin is already reviewing.
  if (state.status !== "LOCKED") {
    return NextResponse.json({ error: "Game is not live for claims" }, { status: 400 });
  }

  const entry = (state.entries || []).find((e) => e.wallet === wallet);
  if (!entry || !(entry.cardIds || []).includes(cardId)) {
    return NextResponse.json({ error: "That card is not entered for this wallet" }, { status: 400 });
  }

  if ((state.winners || []).some((w) => w.cardId === cardId)) {
    return NextResponse.json({ error: "That card already claimed" }, { status: 400 });
  }

  state.winners = state.winners || [];
  state.winners.push({
    cardId,
    wallet,
    isFounders: false, // MVP: don’t trust client
    ts: Date.now(),
  });

  // Force pause so admin can review and players can’t spam claims
  state.status = "PAUSED";

  const saved = await saveState(state);
  const { buildStateResponse } = await import("../_stateResponse");
  return NextResponse.json(await buildStateResponse(saved, wallet), { headers: { "Cache-Control": "no-store" } });
}
