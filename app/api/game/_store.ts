import "server-only";

type GameType = "STANDARD" | "FOUR_CORNERS" | "BLACKOUT";
type GameStatus = "CLOSED" | "OPEN" | "LOCKED" | "PAUSED" | "ENDED";

export type Winner = { cardId: string; wallet: string; isFounders: boolean; ts: number };

export type GameState = {
  gameId: string;
  gameNumber: number;
  gameType: GameType;
  status: GameStatus;
  entryFeeSol: number;
  calledNumbers: number[];
  winners: Winner[];
  entries: Array<{
    wallet: string;
    cardIds: string[];
    signature: string;
    totalSol: number;
    ts: number;
  }>;

  // Progressive jackpot carries across games until admin resets
  progressiveJackpotSol: number;

  updatedAt: number;
};

const DEFAULT_STATE: GameState = {
  gameId: "game-1",
  gameNumber: 1,
  gameType: "STANDARD",
  status: "CLOSED",
  entryFeeSol: 0.05,
  calledNumbers: [],
  winners: [],
  entries: [],
  progressiveJackpotSol: 0,
  updatedAt: Date.now(),
};

const KEY = "nftbingo:gameState:v2";

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

export async function loadState(): Promise<GameState> {
  if (!hasUpstash()) {
    if (!memoryState) memoryState = { ...DEFAULT_STATE, updatedAt: Date.now() };
    return memoryState;
  }

  const out = await upstashPipeline([["GET", KEY]]);
  const v = out?.[0]?.result;

  if (!v) return await saveState({ ...DEFAULT_STATE, updatedAt: Date.now() });

  try {
    const parsed = JSON.parse(v) as Partial<GameState>;
    // Backward compatibility if older key existed
    return {
      ...DEFAULT_STATE,
      ...parsed,
      progressiveJackpotSol: Number(parsed.progressiveJackpotSol ?? DEFAULT_STATE.progressiveJackpotSol) || 0,
      updatedAt: Date.now(),
    };
  } catch {
    return await saveState({ ...DEFAULT_STATE, updatedAt: Date.now() });
  }
}

export async function saveState(state: GameState): Promise<GameState> {
  const next: GameState = { ...state, updatedAt: Date.now() };

  if (!hasUpstash()) {
    memoryState = next;
    return next;
  }

  await upstashPipeline([["SET", KEY, JSON.stringify(next)]]);
  return next;
}

export function derivePots(state: GameState) {
  const entriesCount = state.entries.reduce(
    (acc, e) => acc + (Array.isArray(e.cardIds) ? e.cardIds.length : 0),
    0
  );

  const totalPotSol = entriesCount * (state.entryFeeSol || 0);
  const playerPotSol = totalPotSol * 0.75;
  const foundersBonusSol = totalPotSol * 0.05;
  const foundersPotSol = playerPotSol + foundersBonusSol; // 80%
  const progressive = state.progressiveJackpotSol || 0;
  const jackpotSol = progressive + totalPotSol * 0.05;

  return {
    entriesCount,
    totalPotSol,
    playerPotSol,
    foundersPotSol,
    foundersBonusSol,
    jackpotSol,
  };
}

// When a game rolls over, bank this game's jackpot contribution into the progressive pool.
export function bankProgressiveJackpot(state: GameState): GameState {
  const { totalPotSol } = derivePots(state);
  const add = totalPotSol * 0.05;
  return {
    ...state,
    progressiveJackpotSol: Math.round(((state.progressiveJackpotSol || 0) + add) * 1e9) / 1e9,
  };
}

export function ensureUniqueCalled(called: number[], n: number) {
  if (called.includes(n)) return called;
  return [...called, n];
}

export function removeLastCalled(called: number[]) {
  if (!called.length) return called;
  return called.slice(0, -1);
}

export function makeNewGame(prev: GameState): GameState {
  const newId = `game-${prev.gameNumber}-${Date.now()}`;
  return {
    ...prev,
    gameId: newId,
    status: "OPEN",
    calledNumbers: [],
    winners: [],
    entries: [],
    // keep progressiveJackpotSol
    updatedAt: Date.now(),
  };
}
