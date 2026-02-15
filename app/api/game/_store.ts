import "server-only";

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

  // progressive jackpot
  progressiveJackpotSol: number;
  currentGameJackpotSol: number;

  // claim window
  claimWindowEndsAt: number | null;
  lastClaim: { wallet: string; cardId: string; ts: number } | null;

  // optimistic version for safe writes
  version: number;

  updatedAt: number;
};

export const GAME_STATE_KEY = "nftbingo:gameState:v6";

export const DEFAULT_STATE: GameState = {
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
  claimWindowEndsAt: null,
  lastClaim: null,
  version: 1,
  updatedAt: Date.now(),
};

export const DEFAULT_STATE_JSON = JSON.stringify(DEFAULT_STATE);

export function getUpstashRestUrl() {
  return process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim() || "";
}
export function getUpstashRestToken() {
  return process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim() || "";
}
export function hasUpstash() {
  return Boolean(getUpstashRestUrl() && getUpstashRestToken());
}

export async function upstashPipeline(commands: Array<Array<string>>) {
  const url = getUpstashRestUrl();
  const token = getUpstashRestToken();

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof data === "object" && data ? JSON.stringify(data).slice(0, 600) : "no-json";
    throw new Error(`Upstash error (${res.status}): ${detail}`);
  }
  return data as Array<{ result: any; error?: any }>;
}

export async function upstashEval(script: string, keys: string[], args: Array<string | number>) {
  // Redis EVAL: EVAL <script> <numkeys> <key1..> <arg1..>
  const cmd: Array<string> = ["EVAL", script, String(keys.length), ...keys.map(String), ...args.map(String)];
  const out = await upstashPipeline([cmd]);
  const r = out?.[0];
  if (!r) throw new Error("Upstash eval returned no result.");
  if (r.error) throw new Error(typeof r.error === "string" ? r.error : JSON.stringify(r.error));
  return r.result;
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

  // Match UI semantics
  const playerPotSol = totalPotSol * 0.75;
  const foundersBonusSol = totalPotSol * 0.05;
  const foundersPotSol = playerPotSol + foundersBonusSol;

  const currentGameJackpotSol = totalPotSol * 0.05;
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

export function withRecalc(state: GameState): GameState {
  const pots = derivePots(state);
  return { ...state, currentGameJackpotSol: pots.currentGameJackpotSol };
}

export async function loadState(): Promise<GameState> {
  if (!hasUpstash()) {
    if (!memoryState) memoryState = withRecalc({ ...DEFAULT_STATE, updatedAt: Date.now(), version: 1 });
    return memoryState;
  }

  const out = await upstashPipeline([["GET", GAME_STATE_KEY]]);
  const raw = out?.[0]?.result;

  if (!raw) {
    const seeded = withRecalc({ ...DEFAULT_STATE, updatedAt: Date.now(), version: 1 });
    await saveState(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GameState>;
    const merged: GameState = withRecalc({
      ...DEFAULT_STATE,
      ...parsed,
      calledNumbers: Array.isArray((parsed as any).calledNumbers) ? (parsed as any).calledNumbers : [],
      entries: Array.isArray((parsed as any).entries) ? (parsed as any).entries : [],
      winners: Array.isArray((parsed as any).winners) ? (parsed as any).winners : [],
      progressiveJackpotSol: Number((parsed as any).progressiveJackpotSol || 0),
      claimWindowEndsAt: typeof (parsed as any).claimWindowEndsAt === "number" ? (parsed as any).claimWindowEndsAt : null,
      lastClaim: (parsed as any).lastClaim || null,
      version: Number((parsed as any).version || 1),
      updatedAt: Date.now(),
    });
    return merged;
  } catch {
    const seeded = withRecalc({ ...DEFAULT_STATE, updatedAt: Date.now(), version: 1 });
    await saveState(seeded);
    return seeded;
  }
}

export async function saveState(state: GameState): Promise<GameState> {
  const next = withRecalc({
    ...state,
    version: Number.isFinite((state as any).version) ? (state.version || 0) + 1 : 1,
    updatedAt: Date.now(),
  });

  if (!hasUpstash()) {
    memoryState = next;
    return next;
  }

  await upstashPipeline([["SET", GAME_STATE_KEY, JSON.stringify(next)]]);
  return next;
}

export function makeNewGame(prev: GameState): GameState {
  return withRecalc({
    ...prev,
    gameId: `game-${prev.gameNumber}-${Date.now()}`,
    status: "OPEN",
    calledNumbers: [],
    winners: [],
    entries: [],
    claimWindowEndsAt: null,
    lastClaim: null,
    currentGameJackpotSol: 0,
    version: (prev.version || 0) + 1,
    updatedAt: Date.now(),
  });
}
