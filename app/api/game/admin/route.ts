import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  DEFAULT_STATE_JSON,
  GAME_STATE_KEY,
  hasUpstash,
  loadState,
  makeNewGame,
  saveState,
  upstashEval,
} from "../_store";
import { buildStateResponse } from "../_stateResponse";

async function isAdminCookie() {
  const cookieStore = await cookies();
  const c = cookieStore.get("nftbingo_admin")?.value;
  return c === "1";
}

function normalizeAdminAction(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  // Convert camelCase / kebab / spaced into SCREAMING_SNAKE_CASE
  const upper = raw
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

  switch (upper) {
    // Buy-in aliases -> SET_FEE
    case "SET_BUYIN":
    case "SET_BUY_IN":
    case "SET_BUYIN_USD":
    case "SET_BUY_IN_USD":
    case "SET_BUYIN_SOL":
    case "SET_BUY_IN_SOL":
    case "SET_ENTRYFEE":
    case "SET_ENTRY_FEE":
    case "SET_ENTRY_FEE_SOL":
    case "SET_FEE_SOL":
      return "SET_FEE";

    // Game type aliases
    case "SET_GAMETYPE":
    case "SET_GAME_TYPE":
      return "SET_TYPE";

    // Open aliases (we treat as NEW_GAME because opening a round resets entries/called numbers)
    case "OPEN":
    case "OPEN_GAME":
    case "OPEN_SIGNUPS":
    case "OPEN_GAME_SIGNUPS":
      return "NEW_GAME";

    // Lock aliases
    case "LOCK_START":
    case "LOCK_GAME":
    case "START":
    case "START_GAME":
      return "LOCK";

    // Pause aliases
    case "PAUSE":
    case "RESUME":
    case "PAUSE_GAME":
    case "RESUME_GAME":
      return "PAUSE_TOGGLE";

    // End aliases
    case "END_GAME":
    case "STOP":
    case "STOP_GAME":
      return "END";

    // Close/next aliases
    case "CLOSE":
    case "CLOSE_AND_NEXT":
    case "NEXT_GAME":
      return "CLOSE_NEXT";

    // Undo aliases
    case "UNDO":
    case "UNDO_CALL":
    case "UNDO_LAST_CALL":
      return "UNDO_LAST";

    // Call aliases
    case "CALL":
    case "CALLNUMBER":
    case "CALL_NUMBER":
      return "CALL_NUMBER";

    default:
      return upper;
  }
}


export const runtime = "nodejs";

const ADMIN_LUA = `
-- KEYS[1] = game state key
-- ARGV[1] = defaultStateJson
-- ARGV[2] = action
-- ARGV[3] = number (optional)
-- ARGV[4] = gameType (optional)
-- ARGV[5] = entryFeeSol (optional)
-- ARGV[6] = nowMs

local stateKey = KEYS[1]
local defaultStateJson = ARGV[1]
local action = tostring(ARGV[2] or "")
local n = tonumber(ARGV[3])
local gt = tostring(ARGV[4] or "")
local fee = tonumber(ARGV[5])
local nowMs = tonumber(ARGV[6])

local raw = redis.call("GET", stateKey)
if not raw or raw == false then raw = defaultStateJson end
local state = cjson.decode(raw)

local function recomputeJackpot()
  local entriesCount = 0
  if type(state.entries) == "table" then
    for _, e in ipairs(state.entries) do
      if e and type(e.cardIds) == "table" then
        entriesCount = entriesCount + #e.cardIds
      end
    end
  else
    state.entries = {}
  end
  local fee2 = tonumber(state.entryFeeSol) or 0
  local totalPotSol = entriesCount * fee2
  state.currentGameJackpotSol = totalPotSol * 0.05
end

if action == "NEW_GAME" then
  -- Start accepting entries (keep progressive jackpot)
  state.gameId = "game-" .. tostring(state.gameNumber or 1) .. "-" .. tostring(nowMs)
  state.status = "OPEN"
  state.calledNumbers = {}
  state.winners = {}
  state.entries = {}
  state.claimWindowEndsAt = cjson.null
  state.lastClaim = cjson.null
  state.currentGameJackpotSol = 0

elseif action == "LOCK" then
  state.status = "LOCKED"

elseif action == "PAUSE_TOGGLE" then
  if tostring(state.status) == "LOCKED" then state.status = "PAUSED"
  elseif tostring(state.status) == "PAUSED" then state.status = "LOCKED"
  end

elseif action == "END" then
  -- End the game (does not auto-pay; just stops play)
  state.status = "ENDED"

elseif action == "CLOSE_NEXT" then
  -- Close and prep next game number; roll current jackpot into progressive carry-over
  recomputeJackpot()
  local carry = tonumber(state.currentGameJackpotSol) or 0
  state.progressiveJackpotSol = (tonumber(state.progressiveJackpotSol) or 0) + carry
  state.currentGameJackpotSol = 0

  local nextNum = (tonumber(state.gameNumber) or 1) + 1
  state.gameNumber = nextNum
  state.status = "CLOSED"
  state.calledNumbers = {}
  state.winners = {}
  state.entries = {}
  state.claimWindowEndsAt = cjson.null
  state.lastClaim = cjson.null
  state.gameId = "game-" .. tostring(nextNum) .. "-" .. tostring(nowMs)

elseif action == "CALL_NUMBER" then
  if not (tostring(state.status) == "LOCKED" or tostring(state.status) == "PAUSED") then
    return {err="Game not locked"}
  end
  if not n or n < 1 or n > 75 then
    return {err="Invalid number"}
  end
  if type(state.calledNumbers) ~= "table" then state.calledNumbers = {} end
  local exists = false
  for _, v in ipairs(state.calledNumbers) do
    if tonumber(v) == n then exists = true break end
  end
  if not exists then table.insert(state.calledNumbers, n) end

elseif action == "UNDO_LAST" then
  if not (tostring(state.status) == "LOCKED" or tostring(state.status) == "PAUSED") then
    return {err="Game not locked"}
  end
  if type(state.calledNumbers) ~= "table" then state.calledNumbers = {} end
  if #state.calledNumbers > 0 then table.remove(state.calledNumbers, #state.calledNumbers) end

elseif action == "SET_TYPE" then
  if gt ~= "STANDARD" and gt ~= "FOUR_CORNERS" and gt ~= "BLACKOUT" then
    return {err="Invalid game type"}
  end
  if not (tostring(state.status) == "OPEN" or tostring(state.status) == "CLOSED") then
    return {err="Can't change type during a live game"}
  end
  state.gameType = gt

elseif action == "SET_FEE" then
  if not fee or fee <= 0 or fee >= 100 then
    return {err="Invalid entry fee"}
  end
  if not (tostring(state.status) == "OPEN" or tostring(state.status) == "CLOSED") then
    return {err="Can't change entry fee during a live game"}
  end
  -- normalize to 8 decimals max
  local scaled = math.floor(fee * 100000000 + 0.5)
  state.entryFeeSol = scaled / 100000000
  recomputeJackpot()

else
  return {err="Unknown action"}
end

state.updatedAt = nowMs
state.version = (tonumber(state.version) or 0) + 1

redis.call("SET", stateKey, cjson.encode(state))
return cjson.encode(state)
`;

export async function POST(req: Request) {
  if (!(await isAdminCookie())) {
    return NextResponse.json({ error: "Admin only" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = normalizeAdminAction(String(body?.action || ""));

  if (hasUpstash()) {
    const now = Date.now();
    try {
      const savedStateJson = (await upstashEval(
        ADMIN_LUA,
        [GAME_STATE_KEY],
        [
          DEFAULT_STATE_JSON,
          action,
          typeof body?.number === "number" || typeof body?.number === "string" ? body.number : "",
          typeof body?.gameType === "string" ? body.gameType : "",
          typeof (body?.entryFeeSol ?? body?.feeSol ?? body?.fee ?? body?.buyInSol ?? body?.buyInUsd ?? body?.buyIn) === "number" || typeof (body?.entryFeeSol ?? body?.feeSol ?? body?.fee ?? body?.buyInSol ?? body?.buyInUsd ?? body?.buyIn) === "string" ? (body.entryFeeSol ?? body.feeSol ?? body.fee ?? body.buyInSol ?? body.buyInUsd ?? body.buyIn) : "",
          now,
        ]
      )) as string;

      const state = JSON.parse(savedStateJson);
      return NextResponse.json(await buildStateResponse(state), { headers: { "Cache-Control": "no-store" } });
    } catch (e: any) {
      const msg = e?.message || String(e);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // Local dev fallback (non-atomic)
  const state = await loadState();
  let next = { ...state } as any;

  switch (action) {
    case "NEW_GAME":
      next = makeNewGame(state);
      break;

    case "LOCK":
      next.status = "LOCKED";
      break;

    case "PAUSE_TOGGLE":
      if (next.status === "LOCKED") next.status = "PAUSED";
      else if (next.status === "PAUSED") next.status = "LOCKED";
      break;

    case "END":
      next.status = "ENDED";
      break;

    case "CLOSE_NEXT":
      next.progressiveJackpotSol = (next.progressiveJackpotSol || 0) + (next.currentGameJackpotSol || 0);
      next.currentGameJackpotSol = 0;
      next.gameNumber = (state.gameNumber || 1) + 1;
      next.status = "CLOSED";
      next.calledNumbers = [];
      next.winners = [];
      next.entries = [];
      next.gameId = `game-${next.gameNumber}-${Date.now()}`;
      next.claimWindowEndsAt = null;
      next.lastClaim = null;
      break;

    case "CALL_NUMBER": {
      const n = Number(body?.number);
      if (!(n >= 1 && n <= 75)) return NextResponse.json({ error: "Invalid number" }, { status: 400 });
      if (next.status !== "LOCKED" && next.status !== "PAUSED") return NextResponse.json({ error: "Game not locked" }, { status: 400 });
      next.calledNumbers = Array.from(new Set([...(next.calledNumbers || []), n]));
      break;
    }

    case "UNDO_LAST":
      if (next.status !== "LOCKED" && next.status !== "PAUSED") return NextResponse.json({ error: "Game not locked" }, { status: 400 });
      next.calledNumbers = (next.calledNumbers || []).slice(0, -1);
      break;

    case "SET_TYPE": {
      const t = String(body?.gameType || "");
      if (!["STANDARD", "FOUR_CORNERS", "BLACKOUT"].includes(t)) return NextResponse.json({ error: "Invalid game type" }, { status: 400 });
      if (next.status !== "OPEN" && next.status !== "CLOSED") return NextResponse.json({ error: "Can't change type during a live game" }, { status: 400 });
      next.gameType = t;
      break;
    }

    case "SET_FEE": {
      const feeRaw = body?.entryFeeSol ?? body?.feeSol ?? body?.fee ?? body?.buyInSol ?? body?.buyInUsd ?? body?.buyIn;
      const fee = typeof feeRaw === "string" ? Number(feeRaw) : Number(feeRaw);
      if (!Number.isFinite(fee) || fee <= 0 || fee >= 100) return NextResponse.json({ error: "Invalid entry fee" }, { status: 400 });
      if (next.status !== "OPEN" && next.status !== "CLOSED") return NextResponse.json({ error: "Can't change entry fee during a live game" }, { status: 400 });
      next.entryFeeSol = Math.round(fee * 1e8) / 1e8;
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  next = await saveState(next);
  return NextResponse.json(await buildStateResponse(next), { headers: { "Cache-Control": "no-store" } });
}

