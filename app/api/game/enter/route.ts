import { NextResponse } from "next/server";
import { verifySolTransferTx } from "../_verifySolTx";
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

const USED_SIG_PREFIX = "nftbingo:usedSig:";
const USED_SIG_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

const ENTER_LUA = `
-- KEYS[1] = game state key
-- KEYS[2] = used signature key
-- ARGV[1] = defaultStateJson
-- ARGV[2] = wallet
-- ARGV[3] = signature
-- ARGV[4] = totalSol (string/number)
-- ARGV[5] = cardIdsJson
-- ARGV[6] = nowMs
-- ARGV[7] = usedSigTtlSeconds

local stateKey = KEYS[1]
local usedKey = KEYS[2]

local defaultStateJson = ARGV[1]
local wallet = ARGV[2]
local sig = ARGV[3]
local totalSol = tonumber(ARGV[4])
local cardIds = cjson.decode(ARGV[5] or "[]")
local nowMs = tonumber(ARGV[6])
local ttl = tonumber(ARGV[7])

if not wallet or wallet == "" then return {err="Missing wallet"} end
if not sig or sig == "" then return {err="Missing signature"} end
if not totalSol or totalSol <= 0 then return {err="Invalid totalSol"} end
if type(cardIds) ~= "table" or #cardIds == 0 then return {err="No cards"} end

-- Prevent replay of same sig (atomic with entry save)
local ok = redis.call("SETNX", usedKey, "1")
if ok ~= 1 then
  return {err="This transaction signature was already used."}
end
if ttl and ttl > 0 then
  redis.call("EXPIRE", usedKey, ttl)
end

local raw = redis.call("GET", stateKey)
if not raw or raw == false then
  raw = defaultStateJson
end

local state = cjson.decode(raw)

if state.status ~= "OPEN" then
  return {err="Entries are not open"}
end

-- One entry per wallet per game (MVP)
if type(state.entries) == "table" then
  for _, e in ipairs(state.entries) do
    if e and e.wallet == wallet then
      return {err="This wallet already entered this game"}
    end
  end
else
  state.entries = {}
end

-- Prevent duplicate cards across wallets in a game
local existing = {}
for _, e in ipairs(state.entries) do
  if e and type(e.cardIds) == "table" then
    for _, cid in ipairs(e.cardIds) do
      existing[tostring(cid)] = true
    end
  end
end
for _, cid in ipairs(cardIds) do
  if existing[tostring(cid)] then
    return {err="One or more cards already entered this game"}
  end
end

local fee = tonumber(state.entryFeeSol) or 0
local expectedSol = fee * (#cardIds)
-- allow tiny float drift
if math.abs(expectedSol - totalSol) > 0.00002 then
  return {err="totalSol does not match entry fee"}
end

local entry = {
  wallet = wallet,
  cardIds = cardIds,
  signature = sig,
  totalSol = totalSol,
  ts = nowMs
}
table.insert(state.entries, entry)

-- Recompute currentGameJackpotSol = totalPot * 0.05
local entriesCount = 0
for _, e in ipairs(state.entries) do
  if e and type(e.cardIds) == "table" then
    entriesCount = entriesCount + #e.cardIds
  end
end
local totalPotSol = entriesCount * fee
state.currentGameJackpotSol = totalPotSol * 0.05

state.updatedAt = nowMs
state.version = (tonumber(state.version) or 0) + 1

redis.call("SET", stateKey, cjson.encode(state))
return cjson.encode(state)
`;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const wallet = String(body?.wallet || "");
  const signature = String(body?.signature || "");
  const totalSol = Number(body?.totalSol);
  const cardIds = Array.isArray(body?.cardIds) ? body.cardIds.map((x: any) => String(x)) : [];

  if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  if (!Number.isFinite(totalSol) || !(totalSol > 0)) {
    return NextResponse.json({ error: "Invalid totalSol" }, { status: 400 });
  }
  if (cardIds.length === 0) return NextResponse.json({ error: "No cards" }, { status: 400 });

  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  const pot = process.env.NEXT_PUBLIC_GAME_POT_WALLET?.trim();
  if (!rpcUrl) return NextResponse.json({ error: "Missing NEXT_PUBLIC_SOLANA_RPC_URL" }, { status: 500 });
  if (!pot) return NextResponse.json({ error: "Missing NEXT_PUBLIC_GAME_POT_WALLET" }, { status: 500 });

  // Verify SOL transfer on-chain first (cheap protection against spam/abuse)
  const expectedLamports = Math.round(totalSol * 1_000_000_000);
  await verifySolTransferTx({
    rpcUrl,
    signature,
    expectedFrom: wallet,
    expectedTo: pot,
    minLamports: expectedLamports,
  });

  // Persist atomically
  let savedStateJson: string | null = null;

  if (hasUpstash()) {
    const usedSigKey = `${USED_SIG_PREFIX}${signature}`;
    const now = Date.now();

    try {
      savedStateJson = (await upstashEval(
        ENTER_LUA,
        [GAME_STATE_KEY, usedSigKey],
        [DEFAULT_STATE_JSON, wallet, signature, totalSol, JSON.stringify(cardIds), now, USED_SIG_TTL_SECONDS]
      )) as string;
    } catch (e: any) {
      const msg = e?.message || String(e);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } else {
    // Local dev fallback
    const state = await loadState();

    if (state.status !== "OPEN") return NextResponse.json({ error: "Entries are not open" }, { status: 400 });
    if ((state.entries || []).some((e) => e.wallet === wallet)) {
      return NextResponse.json({ error: "This wallet already entered this game" }, { status: 400 });
    }

    const existing = new Set((state.entries || []).flatMap((e) => e.cardIds || []));
    for (const id of cardIds) {
      if (existing.has(id)) return NextResponse.json({ error: "One or more cards already entered this game" }, { status: 400 });
    }

    const expectedSol = (state.entryFeeSol || 0) * cardIds.length;
    if (Math.abs(expectedSol - totalSol) > 0.00002) {
      return NextResponse.json({ error: "totalSol does not match entry fee" }, { status: 400 });
    }

    state.entries = state.entries || [];
    state.entries.push({ wallet, cardIds, signature, totalSol, ts: Date.now() });

    const saved = await saveState(state);
    return NextResponse.json(await buildStateResponse(saved, wallet), { headers: { "Cache-Control": "no-store" } });
  }

  const parsed = JSON.parse(savedStateJson!) as any;
  // normalize through load/save helpers’ expectations
  const payload = await buildStateResponse(parsed, wallet);

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}


