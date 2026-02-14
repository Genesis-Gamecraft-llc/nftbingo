import "server-only";
import type { PublicKey } from "@solana/web3.js";

export type GameType = "STANDARD" | "FOUR_CORNERS" | "BLACKOUT";
export type GameStatus = "CLOSED" | "OPEN" | "LOCKED" | "PAUSED" | "ENDED";

export type Entry = {
  wallet: string;
  cardIds: string[];
  signature?: string;
  totalSol?: number;
  ts?: number;
};

export type Winner = {
  cardId: string;
  wallet: string;
  isFounders: boolean;
  ts: number;
};

export type GameState = {
  gameId: string;
  gameNumber: number;
  gameType: GameType;
  status: GameStatus;
  entryFeeSol: number;
  calledNumbers: number[];
  entries: Entry[];
  winners: Winner[];

  // Progressive jackpot that persists across games until admin resets
  progressiveJackpotSol: number;

  // Current game’s jackpot contribution (derived from current game pot)
  currentGameJackpotSol: number;

  updatedAt: number;
};

const KEY = "nftbingo:gameState:v2";

const DEFAULT_STATE: GameState = {
  gameId: "game-1",
  gameNumber: 1,
  gameType: "STANDARD",
  status: "CLOSED",
  entryFeeSol: 0.05,
  calledNumbers: [],
  entries: [],
  winners: [],
  progressiveJackpotSol: 0,
  currentGameJackpotSol: 0,
  updatedAt: Date.now(),
};

function getUpstashRestUrl() {
  const u = process.env.UPSTASH_REDIS_REST_URL?.trim();
  if (u) return u;
  const kv = process.env.KV_REST_API_URL?.trim();
  if (kv) return kv;
  return "";
}
function getUpstashRestToken() {
  const t = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (t) return t;
  const kv = process.env.KV_REST_API_TOKEN?.trim();
  if (kv) return kv;
  return "";
}
function hasUpstash() {
  return Boolean(getUpstashRestUrl() && getUpstashRestToken());
}

/**
 * Upstash Redis REST pipeline expects body: [["CMD","arg1","arg2"], ["CMD2",...]]
 */
async function upstashPipeline(commands: Array<Array<string>>) {
  const url = getUpstashRestUrl();
  const token = getUpstashRestToken();

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail =
      typeof data === "object" && data ? JSON.stringify(data).slice(0, 300) : "no-json";
    throw new Error(`Upstash error (${res.status}): ${detail}`);
  }

  return data as Array<{ result: any; error?: any }>;
}

let memoryState: GameState | null = null;

export function ensureUniqueCalled(called: number[], n: number) {
  if (called.includes(n)) return called;
  return [...called, n];
}

export function removeLastCalled(called: number[]) {
  if (!called.length) return called;
  return called.slice(0, -1);
}

export function derivePots(state: GameState) {
  const entriesCount = (state.entries || []).reduce(
    (acc, e) => acc + (Array.isArray(e.cardIds) ? e.cardIds.length : 0),
    0
  );

  const totalPotSol = entriesCount * (state.entryFeeSol || 0);

  // Split logic (keeps your prior semantics intact)
  const playerPotSol = totalPotSol * 0.75;
  const foundersBonusSol = totalPotSol * 0.05;
  const foundersPotSol = playerPotSol + foundersBonusSol;

  // Current game contribution to progressive jackpot
  const currentGameJackpotSol = totalPotSol * 0.05;

  // Progressive jackpot shown to users
  const jackpotSol = (state.progressiveJackpotSol || 0) + currentGameJackpotSol;

  return {
    entriesCount,
    totalPotSol,
    playerPotSol,
    foundersPotSol,
    foundersBonusSol,
    currentGameJackpotSol,
    jackpotSol,
  };
}

function withRecalculatedJackpot(state: GameState): GameState {
  const pots = derivePots(state);
  return { ...state, currentGameJackpotSol: pots.currentGameJackpotSol };
}

export async function loadState(): Promise<GameState> {
  if (!hasUpstash()) {
    if (!memoryState) memoryState = withRecalculatedJackpot({ ...DEFAULT_STATE, updatedAt: Date.now() });
    return memoryState;
  }

  const out = await upstashPipeline([["GET", KEY]]);
  const raw = out?.[0]?.result;

  if (!raw) {
    const seeded = withRecalculatedJackpot({ ...DEFAULT_STATE, updatedAt: Date.now() });
    await saveState(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as GameState;
    // Backfill missing fields safely
    const merged: GameState = {
      ...DEFAULT_STATE,
      ...parsed,
      calledNumbers: Array.isArray((parsed as any).calledNumbers) ? (parsed as any).calledNumbers : [],
      entries: Array.isArray((parsed as any).entries) ? (parsed as any).entries : [],
      winners: Array.isArray((parsed as any).winners) ? (parsed as any).winners : [],
      progressiveJackpotSol: Number((parsed as any).progressiveJackpotSol || 0),
      currentGameJackpotSol: Number((parsed as any).currentGameJackpotSol || 0),
      updatedAt: Date.now(),
    };
    return withRecalculatedJackpot(merged);
  } catch {
    const seeded = withRecalculatedJackpot({ ...DEFAULT_STATE, updatedAt: Date.now() });
    await saveState(seeded);
    return seeded;
  }
}

export async function saveState(state: GameState): Promise<GameState> {
  const next = withRecalculatedJackpot({ ...state, updatedAt: Date.now() });

  if (!hasUpstash()) {
    memoryState = next;
    return next;
  }

  await upstashPipeline([["SET", KEY, JSON.stringify(next)]]);
  return next;
}

export function makeNewGame(prev: GameState): GameState {
  const newNumber = prev.gameNumber || 1;
  return withRecalculatedJackpot({
    ...prev,
    gameId: `game-${newNumber}-${Date.now()}`,
    status: "OPEN",
    calledNumbers: [],
    winners: [],
    entries: [],
    // current game jackpot resets; progressive remains
    currentGameJackpotSol: 0,
    updatedAt: Date.now(),
  });
}
