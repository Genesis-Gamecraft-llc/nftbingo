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
  const now = Date.now();

  // Allow claim when live, and additional claims while paused inside window
  if (state.status === "PAUSED") {
    if (!state.claimWindowEndsAt || now > state.claimWindowEndsAt) {
      return NextResponse.json({ error: "Claim window closed" }, { status: 400 });
    }
  } else if (state.status !== "LOCKED") {
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
    const isFounders = (() => {
    // Preferred: mapping saved at /enter time
    const map = (entry as any)?.cardTypesById;
    const tFromMap = map && typeof map === "object" ? String((map as any)[cardId] || "") : "";

    // Fallback (older/alternate shapes): parallel array of cardTypes aligned to cardIds
    const ids: string[] = Array.isArray((entry as any)?.cardIds) ? (entry as any).cardIds.map((x: any) => String(x)) : [];
    const types: string[] = Array.isArray((entry as any)?.cardTypes) ? (entry as any).cardTypes.map((x: any) => String(x)) : [];
    const idx = ids.indexOf(cardId);
    const tFromArr = idx >= 0 && idx < types.length ? String(types[idx] || "") : "";

    const t = (tFromMap || tFromArr || "").toUpperCase();
    return t === "FOUNDERS";
  })();

  state.winners.push({ cardId, wallet, isFounders, ts: now });

  // On first claim, pause and open shared window
  if (state.status === "LOCKED") {
    state.status = "PAUSED";
    state.claimWindowEndsAt = now + 60_000;
  }

  state.lastClaim = { wallet, cardId, ts: now };

  const saved = await saveState(state);
  const { buildStateResponse } = await import("../_stateResponse");
  return NextResponse.json(await buildStateResponse(saved, wallet), { headers: { "Cache-Control": "no-store" } });
}
