import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  loadState,
  saveState,
  ensureUniqueCalled,
  removeLastCalled,
  makeNewGame,
  type GameType,
} from "../_store";

export const runtime = "nodejs";

async function isAdminCookie() {
  const cookieStore = await cookies();
  return cookieStore.get("nftbingo_admin")?.value === "1";
}

export async function POST(req: Request) {
  if (!(await isAdminCookie())) {
    return NextResponse.json({ error: "Admin only" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");

  const state = await loadState();
  let next = { ...state };

  switch (action) {
    case "NEW_GAME": {
      next = makeNewGame(state);
      break;
    }

    case "LOCK": {
      next.status = "LOCKED";
      break;
    }

    case "RESUME": {
      next.status = "LOCKED";
      next.claimWindowEndsAt = null;
      next.lastClaim = null;
      break;
    }

    case "PAUSE_TOGGLE": {
      if (next.status === "LOCKED") next.status = "PAUSED";
      else if (next.status === "PAUSED") next.status = "LOCKED";
      break;
    }

    case "END": {
      next.status = "ENDED";
      break;
    }

    case "CLOSE_NEXT": {
      // Bank this game’s jackpot contribution into progressive pool BEFORE clearing entries
      next.progressiveJackpotSol = (next.progressiveJackpotSol || 0) + (state.currentGameJackpotSol || 0);

      next.gameNumber = (state.gameNumber || 1) + 1;
      next.gameId = `game-${next.gameNumber}-${Date.now()}`;
      next.status = "CLOSED";
      next.calledNumbers = [];
      next.winners = [];
      next.entries = [];
      next.currentGameJackpotSol = 0;
      next.claimWindowEndsAt = null;
      next.lastClaim = null;
      break;
    }

    case "RESET_JACKPOT": {
      next.progressiveJackpotSol = 0;
      next.currentGameJackpotSol = 0;
      break;
    }

    case "CALL_NUMBER": {
      const n = Number(body?.number);
      if (!(n >= 1 && n <= 75)) return NextResponse.json({ error: "Invalid number" }, { status: 400 });
      if (next.status !== "LOCKED") return NextResponse.json({ error: "Game not locked" }, { status: 400 });
      next.calledNumbers = ensureUniqueCalled(next.calledNumbers || [], n);
      break;
    }

    case "UNDO_LAST": {
      if (next.status !== "LOCKED") return NextResponse.json({ error: "Game not locked" }, { status: 400 });
      next.calledNumbers = removeLastCalled(next.calledNumbers || []);
      break;
    }

    case "SET_TYPE": {
      const t = String(body?.gameType || "");
      if (!["STANDARD", "FOUR_CORNERS", "BLACKOUT"].includes(t)) {
        return NextResponse.json({ error: "Invalid game type" }, { status: 400 });
      }
      if (next.status !== "OPEN" && next.status !== "CLOSED") {
        return NextResponse.json({ error: "Can't change type during a live game" }, { status: 400 });
      }
      next.gameType = t as GameType;
      break;
    }

    case "SET_FEE": {
      const fee = Number(body?.entryFeeSol);
      if (!Number.isFinite(fee) || fee <= 0 || fee >= 100) {
        return NextResponse.json({ error: "Invalid entry fee" }, { status: 400 });
      }
      if (next.status !== "OPEN" && next.status !== "CLOSED") {
        return NextResponse.json({ error: "Can't change fee during a live game" }, { status: 400 });
      }
      next.entryFeeSol = Math.round(fee * 1e8) / 1e8;
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const saved = await saveState(next);
  const { buildStateResponse } = await import("../_stateResponse");
  return NextResponse.json(await buildStateResponse(saved), { headers: { "Cache-Control": "no-store" } });
}
