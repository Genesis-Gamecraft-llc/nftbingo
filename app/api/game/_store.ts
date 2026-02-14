import "server-only";

export type GameState = {
  gameId: string;
  gameNumber: number;
  status: "CLOSED" | "OPEN" | "LOCKED" | "PAUSED" | "ENDED";
  entryFeeSol: number;
  entries: Array<{ wallet: string; cardIds: string[] }>;
  winners: Array<{ cardId: string; wallet: string; isFounders: boolean; ts: number }>;
  progressiveJackpotSol: number;
  currentGameJackpotSol: number;
};

const KEY = "nftbingo:gameState:v2";

const DEFAULT_STATE: GameState = {
  gameId: "game-1",
  gameNumber: 1,
  status: "CLOSED",
  entryFeeSol: 0.05,
  entries: [],
  winners: [],
  progressiveJackpotSol: 0,
  currentGameJackpotSol: 0,
};

async function redisFetch(cmd: any[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const res = await fetch(url + "/pipeline", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([cmd]),
  });

  const data = await res.json();
  if (!res.ok) throw new Error("Upstash error");
  return data;
}

export async function loadState(): Promise<GameState> {
  const out = await redisFetch(["GET", KEY]);
  const raw = out?.[0]?.result;
  if (!raw) return DEFAULT_STATE;
  return JSON.parse(raw);
}

export async function saveState(state: GameState): Promise<GameState> {
  await redisFetch(["SET", KEY, JSON.stringify(state)]);
  return state;
}

export function makeNewGame(prev: GameState): GameState {
  return {
    ...prev,
    gameId: `game-${prev.gameNumber}-${Date.now()}`,
    entries: [],
    winners: [],
    currentGameJackpotSol: 0,
  };
}

export function derivePots(state: GameState) {
  const entriesCount = state.entries.length;
  const totalPotSol = entriesCount * state.entryFeeSol;
  const currentGameJackpotSol = totalPotSol * 0.05;
  const jackpotSol = state.progressiveJackpotSol + currentGameJackpotSol;

  return {
    entriesCount,
    totalPotSol,
    jackpotSol,
  };
}
