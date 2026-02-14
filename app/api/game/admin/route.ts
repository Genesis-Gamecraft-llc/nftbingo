import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loadState, saveState, makeNewGame } from "../_store";

export const runtime = "nodejs";

async function isAdmin() {
  const cookieStore = await cookies();
  return cookieStore.get("nftbingo_admin")?.value === "1";
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin only" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");

  const state = await loadState();
  let next = { ...state };

  switch (action) {
    case "NEW_GAME":
      next = makeNewGame(state);
      break;

    case "LOCK":
      next.status = "LOCKED";
      break;

    case "RESUME":
      next.status = "LOCKED";
      break;

    case "END":
      next.status = "ENDED";
      break;

    case "CLOSE_NEXT":
      next.progressiveJackpotSol += state.currentGameJackpotSol || 0;
      next = makeNewGame({ ...next, gameNumber: state.gameNumber + 1 });
      next.status = "CLOSED";
      break;

    case "RESET_JACKPOT":
      next.progressiveJackpotSol = 0;
      break;

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const saved = await saveState(next);
  return NextResponse.json({ ok: true, state: saved });
}
