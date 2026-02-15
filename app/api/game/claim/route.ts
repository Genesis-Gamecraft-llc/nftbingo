import { NextResponse } from "next/server";
import {
  DEFAULT_STATE_JSON,
  GAME_STATE_KEY,
  hasUpstash,
  loadState,
  saveState,
  upstashEval,
} from "../_store";
import { buildStateResponse } from "../_stateResponse";

export const runtime = "nodejs";

const CLAIM_LUA = `
-- KEYS[1] = game state key
-- ARGV[1] = defaultStateJson
-- ARGV[2] = wallet
-- ARGV[3] = cardId
-- ARGV[4] = nowMs

local stateKey = KEYS[1]
local defaultStateJson = ARGV[1]
local wallet = ARGV[2]
local cardId = ARGV[3]
local nowMs = tonumber(ARGV[4])

if not wallet or wallet == "" then return {err="Missing wallet"} end
if not cardId or cardId == "" then return {err="Missing cardId"} end

local raw = redis.call("GET", stateKey)
if not raw or raw == false then
  raw = defaultStateJson
end
local state = cjson.decode(raw)

local status = tostring(state.status or "")

if status == "PAUSED" then
  if not state.claimWindowEndsAt or tonumber(state.claimWindowEndsAt) < nowMs then
    return {err="Claim window closed"}
  end
elseif status ~= "LOCKED" then
  return {err="Game is not live for claims"}
end

-- Verify that card is entered for this wallet
local ok = false
if type(state.entries) ~= "table" then state.entries = {} end
for _, e in ipairs(state.entries) do
  if e and e.wallet == wallet and type(e.cardIds) == "table" then
    for _, cid in ipairs(e.cardIds) do
      if tostring(cid) == cardId then
        ok = true
        break
      end
    end
  end
  if ok then break end
end
if not ok then
  return {err="That card is not entered for this wallet"}
end

-- Ensure card not already claimed
if type(state.winners) ~= "table" then state.winners = {} end
for _, w in ipairs(state.winners) do
  if w and tostring(w.cardId) == cardId then
    return {err="That card already claimed"}
  end
end

-- Append winner
table.insert(state.winners, {
  cardId = cardId,
  wallet = wallet,
  isFounders = false,
  ts = nowMs
})

-- On first claim, pause and open shared window
if status == "LOCKED" then
  state.status = "PAUSED"
  state.claimWindowEndsAt = nowMs + 60000
end

state.lastClaim = { wallet = wallet, cardId = cardId, ts = nowMs }
state.updatedAt = nowMs
state.version = (tonumber(state.version) or 0) + 1

redis.call("SET", stateKey, cjson.encode(state))
return cjson.encode(state)
`;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const wallet = String(body?.wallet || "");
  const cardId = String(body?.cardId || "");

  if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
  if (!cardId) return NextResponse.json({ error: "Missing cardId" }, { status: 400 });

  if (hasUpstash()) {
    const now = Date.now();
    try {
      const savedStateJson = (await upstashEval(
        CLAIM_LUA,
        [GAME_STATE_KEY],
        [DEFAULT_STATE_JSON, wallet, cardId, now]
      )) as string;

      const state = JSON.parse(savedStateJson);
      const payload = await buildStateResponse(state, wallet);
      return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
    } catch (e: any) {
      const msg = e?.message || String(e);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // Local dev fallback
  const state = await loadState();
  const now = Date.now();

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
  state.winners.push({ cardId, wallet, isFounders: false, ts: now });

  if (state.status === "LOCKED") {
    state.status = "PAUSED";
    state.claimWindowEndsAt = now + 60_000;
  }

  state.lastClaim = { wallet, cardId, ts: now };

  const saved = await saveState(state);
  return NextResponse.json(await buildStateResponse(saved, wallet), { headers: { "Cache-Control": "no-store" } });
}
