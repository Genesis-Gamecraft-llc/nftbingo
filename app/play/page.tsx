"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

type CardType = "PLAYER" | "FOUNDERS";

type BingoCard = {
  id: string; // mint
  label: string;
  type: CardType;
  grid: number[][]; // 5x5, center FREE = 0
};

type ClaimResult = "ACCEPTED" | "REJECTED";

/** ===== Helpers ===== */

async function confirmSignatureByPolling(
  connection: Connection,
  signature: string,
  timeoutMs = 60_000
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });

    const s = st?.value?.[0];
    if (s?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(s.err)}`);
    }

    // confirmationStatus can be "processed" | "confirmed" | "finalized"
    if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
      return;
    }

    // small delay
    await new Promise((r) => setTimeout(r, 800));
  }

  throw new Error("Timed out confirming transaction (polling).");
}
function formatSol(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const s = n.toFixed(n >= 1 ? 3 : n >= 0.1 ? 4 : 5);
  return s.replace(/\.?0+$/, "");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function uniquePush(arr: number[], value: number) {
  if (arr.includes(value)) return arr;
  return [...arr, value];
}

function removeLast(arr: number[]) {
  if (arr.length === 0) return arr;
  return arr.slice(0, -1);
}

/** ===== Pattern checks ===== */

function isFreeCell(r: number, c: number) {
  return r === 2 && c === 2;
}

function cellMarked(grid: number[][], calledSet: Set<number>, r: number, c: number): boolean {
  if (isFreeCell(r, c)) return true;
  const v = grid[r][c];
  if (v === 0) return true;
  return calledSet.has(v);
}

function hasStandardBingo(grid: number[][], calledSet: Set<number>): boolean {
  for (let r = 0; r < 5; r++) {
    let ok = true;
    for (let c = 0; c < 5; c++) {
      if (!cellMarked(grid, calledSet, r, c)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }

  for (let c = 0; c < 5; c++) {
    let ok = true;
    for (let r = 0; r < 5; r++) {
      if (!cellMarked(grid, calledSet, r, c)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }

  let ok1 = true;
  for (let i = 0; i < 5; i++) {
    if (!cellMarked(grid, calledSet, i, i)) {
      ok1 = false;
      break;
    }
  }
  if (ok1) return true;

  let ok2 = true;
  for (let i = 0; i < 5; i++) {
    if (!cellMarked(grid, calledSet, i, 4 - i)) {
      ok2 = false;
      break;
    }
  }
  return ok2;
}

function hasFourCorners(grid: number[][], calledSet: Set<number>): boolean {
  const corners: Array<[number, number]> = [
    [0, 0],
    [0, 4],
    [4, 0],
    [4, 4],
  ];
  return corners.every(([r, c]) => cellMarked(grid, calledSet, r, c));
}

function hasBlackout(grid: number[][], calledSet: Set<number>): boolean {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (!cellMarked(grid, calledSet, r, c)) return false;
    }
  }
  return true;
}

function isWinningByType(gameType: GameType, grid: number[][], calledSet: Set<number>): boolean {
  if (gameType === "STANDARD") return hasStandardBingo(grid, calledSet);
  if (gameType === "FOUR_CORNERS") return hasFourCorners(grid, calledSet);
  return hasBlackout(grid, calledSet);
}

function toNum(v: any): number {
  if (v === "FREE") return 0;
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Convert numbersByLetter → 5x5 grid
 *
 * Supports BOTH:
 * - N length 4: [n0,n1,n2,n3] (no center)
 * - N length 5: [n0,n1,FREE/0,n3,n4]
 *
 * Fixes your bug where N[2] (0) was being placed under FREE and bottom went missing.
 */
function gridFromNumbersByLetter(nbl: any): number[][] | null {
  try {
    const B: any[] = nbl?.B ?? [];
    const I: any[] = nbl?.I ?? [];
    const N: any[] = nbl?.N ?? [];
    const G: any[] = nbl?.G ?? [];
    const O: any[] = nbl?.O ?? [];

    if (B.length < 5 || I.length < 5 || G.length < 5 || O.length < 5) return null;
    if (!(N.length === 4 || N.length === 5)) return null;

    const grid: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));

    for (let r = 0; r < 5; r++) grid[r][0] = toNum(B[r]);
    for (let r = 0; r < 5; r++) grid[r][1] = toNum(I[r]);

    // N column:
    // If N is 5 with FREE/0 in the middle, use indices 0,1,3,4 for rows 0,1,3,4.
    // If N is 4, use indices 0,1,2,3.
    const nTop0 = toNum(N[0]);
    const nTop1 = toNum(N[1]);
    const nBot0 = toNum(N.length === 5 ? N[3] : N[2]);
    const nBot1 = toNum(N.length === 5 ? N[4] : N[3]);

    grid[0][2] = nTop0;
    grid[1][2] = nTop1;
    grid[2][2] = 0; // FREE
    grid[3][2] = nBot0;
    grid[4][2] = nBot1;

    for (let r = 0; r < 5; r++) grid[r][3] = toNum(G[r]);
    for (let r = 0; r < 5; r++) grid[r][4] = toNum(O[r]);

    return grid;
  } catch {
    return null;
  }
}

// Backward-compatible alias (your mapping calls this)
function numbersByLetterToGrid(nbl: any) {
  return gridFromNumbersByLetter(nbl);
}

// Deterministic seed from mint string (fallback demo grid)
function mintToSeed(mint: string): number {
  let h = 2166136261;
  for (let i = 0; i < mint.length; i++) {
    h ^= mint.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}


/** ===== Demo cards (only when wallet not connected / no cards) ===== */

function demoCard(label: string, type: CardType, seed: number): BingoCard {
  const rng = mulberry32(seed);
  const cols: number[][] = [];
  const ranges = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75],
  ];
  for (let c = 0; c < 5; c++) {
    const [a, b] = ranges[c];
    const pool = Array.from({ length: b - a + 1 }, (_, i) => a + i);
    shuffle(pool, rng);
    cols[c] = pool.slice(0, 5);
  }
  const grid = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      grid[r][c] = cols[c][r];
    }
  }
  grid[2][2] = 0;

  return {
    id: `demo-${type}-${seed}`,
    label,
    type,
    grid,
  };
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

/** ===== Small UI components ===== */

function PotCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 border border-slate-100">
      <div className="text-sm text-slate-600">{title}</div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function gameTypeLabel(t: GameType) {
  if (t === "STANDARD") return "Standard";
  if (t === "FOUR_CORNERS") return "4 Corners";
  return "Blackout";
}

function BingoGrid({ grid, calledSet }: { grid: number[][]; calledSet: Set<number> }) {
  const headers = ["B", "I", "N", "G", "O"];
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-5">
        {headers.map((h) => (
          <div key={h} className="bg-slate-900 text-white text-center font-extrabold py-2">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5">
        {grid.flatMap((row, r) =>
          row.map((v, c) => {
            const free = r === 2 && c === 2;
            const marked = free || v === 0 || calledSet.has(v);
            return (
              <div
                key={`${r}-${c}`}
                className={[
                  "aspect-square flex items-center justify-center font-extrabold text-lg border-t border-slate-200 border-r border-slate-200 last:border-r-0",
                  marked ? "bg-emerald-100 text-emerald-900" : "bg-white text-slate-900",
                ].join(" ")}
              >
                {free ? "FREE" : v}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CardCarousel({
  cards,
  calledSet,
  gameType,
}: {
  cards: BingoCard[];
  calledSet: Set<number>;
  gameType: GameType;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (idx >= cards.length) setIdx(0);
  }, [cards.length, idx]);

  const card = cards[idx];
  const isWin = isWinningByType(gameType, card.grid, calledSet);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-semibold text-slate-900">{card.label}</div>
          <div className="text-xs text-slate-600 mt-1">
            {card.type === "FOUNDERS" ? "⭐ Founders Series" : "🎫 Player Series"} • Card {idx + 1} of {cards.length}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isWin ? (
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
              BINGO READY
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">Playing</span>
          )}
        </div>
      </div>

      <BingoGrid grid={card.grid} calledSet={calledSet} />

      {cards.length > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIdx((i) => (i - 1 + cards.length) % cards.length)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % cards.length)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Next
          </button>
        </div>
      )}

      <div className="mt-3 text-xs text-slate-500">
        Game type: <span className="font-semibold text-slate-900">{gameTypeLabel(gameType)}</span>
      </div>
    </div>
  );
}

/** ===== Page ===== */


type GameType = "STANDARD" | "FOUR_CORNERS" | "BLACKOUT";
type GameStatus = "CLOSED" | "OPEN" | "LOCKED" | "PAUSED" | "ENDED";

type ServerWinner = { cardId: string; wallet: string; isFounders: boolean; ts: number };

type ServerMy = { enteredCardIds: string[]; lastSig?: string | null; lastTotalSol?: number | null };

type ServerGameState = {
  ok: true;
  gameId: string;
  gameNumber: number;
  gameType: GameType;
  status: GameStatus;
  entryFeeSol: number;
  calledNumbers: number[];
  winners: ServerWinner[];
  entriesCount: number;
  totalPotSol: number;
  playerPotSol: number;
  foundersPotSol: number;
  foundersBonusSol: number;
  jackpotSol: number;
  progressiveJackpotSol: number;
  currentGameJackpotSol: number;
  claimWindowEndsAt: number | null;
  lastClaim: { wallet: string; cardId: string; ts: number } | null;
  my?: ServerMy;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as any)?.error || (data as any)?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}


export default function PlayPage() {
  // Game config
  const [gameNumber, setGameNumber] = useState<number>(1);
  const [gameType, setGameType] = useState<GameType>("STANDARD");
  const [status, setStatus] = useState<GameStatus>("CLOSED");

  // Entry pricing
  const [entryFeeSol, setEntryFeeSol] = useState<number>(0.05);

  // Server-derived pots (cumulative across all players)
  const [serverEntriesCount, setServerEntriesCount] = useState<number>(0);
  const [serverTotalPotSol, setServerTotalPotSol] = useState<number>(0);
  const [serverPlayerPotSol, setServerPlayerPotSol] = useState<number>(0);
  const [serverFoundersPotSol, setServerFoundersPotSol] = useState<number>(0);
  const [serverFoundersBonusSol, setServerFoundersBonusSol] = useState<number>(0);
  const [serverJackpotSol, setServerJackpotSol] = useState<number>(0);
  const [serverProgressiveJackpotSol, setServerProgressiveJackpotSol] = useState<number>(0);
  const [serverCurrentGameJackpotSol, setServerCurrentGameJackpotSol] = useState<number>(0);

  // Global claim window (shared across all clients)
  const [claimWindowEndsAt, setClaimWindowEndsAt] = useState<number | null>(null);
  const [lastClaim, setLastClaim] = useState<{ wallet: string; cardId: string; ts: number } | null>(null);

  // Wallet-specific entered card ids (from server)
  const [enteredCardIds, setEnteredCardIds] = useState<string[]>([]);

  // Called numbers (MVP: mirror-click admin)
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const calledSet = useMemo(() => new Set(calledNumbers), [calledNumbers]);

  // Selected/entered cards
  const [selectedCards, setSelectedCards] = useState<BingoCard[]>([]);
  const [enteredCards, setEnteredCards] = useState<BingoCard[]>([]); // ✅ paid entries only
  const [maxCards] = useState<number>(5);

  // Wallet inventory (fetched from /api/cards/owned; falls back to demo if not connected)
  const [walletCards, setWalletCards] = useState<BingoCard[]>(() => [
    demoCard("Founders Series Card (Demo)", "FOUNDERS", 41),
    demoCard("Player Series Card (Demo)", "PLAYER", 101),
  ]);
  const [cardsLoading, setCardsLoading] = useState<boolean>(false);
  const [cardsError, setCardsError] = useState<string>("");

  // Payment/entry lock for this game
  const [entriesLocked, setEntriesLocked] = useState<boolean>(false);
  const [lastEntrySig, setLastEntrySig] = useState<string>("");
  const [lastEntryTotalSol, setLastEntryTotalSol] = useState<number>(0);
  const [paying, setPaying] = useState<boolean>(false);

  // Admin UI is gated by cookie set by /admin
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { isAdmin: false }))
      .then((d) => {
        if (!alive) return;
        setIsAdmin(Boolean(d?.isAdmin));
      })
      .catch(() => {
        if (!alive) return;
        setIsAdmin(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Claim UX + basic anti-spam
  const [lastClaimAt, setLastClaimAt] = useState<number>(0);
  const [invalidStrikes, setInvalidStrikes] = useState<number>(0);
  const [claimResult, setClaimResult] = useState<null | { result: ClaimResult; message: string }>(null);
  const [claiming, setClaiming] = useState<boolean>(false);

  // Claim window
  const [claimWindowOpenAt, setClaimWindowOpenAt] = useState<number | null>(null);
  const [claimWindowSecondsLeft, setClaimWindowSecondsLeft] = useState<number>(0);
  const claimWindowTimer = useRef<number | null>(null);

  // Winner list (MVP local)
  const [winners, setWinners] = useState<Array<{ cardId: string; wallet: string; isFounders: boolean }>>([]);

  // Wallet
  const wallet = useWallet();
  const walletAddress = useMemo(() => wallet.publicKey?.toBase58() || "", [wallet.publicKey]);

  // ✅ Sync game state for everyone (server truth)
  useEffect(() => {
    let timer: any = null;
    let stopped = false;

    const tick = async () => {
      try {
        const qs = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : "";
        const s = await fetchJson<ServerGameState>(`/api/game/state${qs}`);
        if (stopped) return;

        setGameNumber(s.gameNumber);
        setGameType(s.gameType);
        setStatus(s.status);
        setEntryFeeSol(s.entryFeeSol);
        setCalledNumbers(s.calledNumbers || []);
        setWinners((s.winners || []).map((w) => ({ cardId: w.cardId, wallet: w.wallet, isFounders: w.isFounders })));

        setServerEntriesCount(s.entriesCount || 0);
        setServerTotalPotSol(s.totalPotSol || 0);
        setServerPlayerPotSol(s.playerPotSol || 0);
        setServerFoundersPotSol(s.foundersPotSol || 0);
        setServerFoundersBonusSol(s.foundersBonusSol || 0);
        setServerJackpotSol(s.jackpotSol || 0);
        setServerProgressiveJackpotSol(s.progressiveJackpotSol || 0);
        setServerCurrentGameJackpotSol(s.currentGameJackpotSol || 0);

        setClaimWindowEndsAt(s.claimWindowEndsAt ?? null);
        setLastClaim(s.lastClaim ?? null);

        if (s.my?.enteredCardIds) {
          setEnteredCardIds(s.my.enteredCardIds);
          setLastEntrySig(String(s.my.lastSig || ""));
          if (typeof s.my.lastTotalSol === "number") setLastEntryTotalSol(s.my.lastTotalSol);
          setEntriesLocked((s.my.enteredCardIds?.length || 0) > 0);
        } else {
          setEnteredCardIds([]);
          setEntriesLocked(false);
        }
      } catch {
        // ignore poll failures
      }
    };

    tick();
    timer = setInterval(tick, 1500);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [walletAddress]);



  // Fetch wallet cards from server (allowed collections only)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!wallet.connected || !walletAddress) {
        setCardsError("");
        setCardsLoading(false);
        // keep demo cards when disconnected
        return;
      }
      setCardsLoading(true);
      setCardsError("");

      try {
        const res = await fetch(`/api/cards/owned?owner=${encodeURIComponent(walletAddress)}`, { cache: "no-store" });
        const j = await res.json();
        if (!j?.ok) throw new Error(j?.error || "Failed to load cards");

        const owned: any[] = Array.isArray(j.cards) ? j.cards : [];

        const mapped: BingoCard[] = owned.map((c) => {
          const series = String(c.series || "").toUpperCase();
          const type: CardType = series === "FOUNDERS" ? "FOUNDERS" : "PLAYER";

          const grid =
            numbersByLetterToGrid(c.numbersByLetter) ||
            demoCard(c.name || `${type} Card`, type, mintToSeed(String(c.mint || ""))).grid;

          return {
            id: String(c.mint || ""),
            label: String(c.name || (type === "FOUNDERS" ? "Founders Series" : "Player Series")),
            type,
            grid,
          };
        });

        if (!cancelled) {
          setWalletCards(mapped.length ? mapped : []);
          if (!mapped.length) setCardsError("No eligible NFTBingo cards found in this wallet.");
        }
      } catch (e: any) {
        if (!cancelled) setCardsError(e?.message ?? "Failed to load cards");
      } finally {
        if (!cancelled) setCardsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [wallet.connected, walletAddress]);

  function openClaimWindow() {
    const openedAt = Date.now();
    setClaimWindowOpenAt(openedAt);
    setClaimWindowSecondsLeft(60);

    if (claimWindowTimer.current) window.clearInterval(claimWindowTimer.current);
    claimWindowTimer.current = window.setInterval(() => {
      setClaimWindowSecondsLeft((s) => {
        const next = s - 1;
        return next < 0 ? 0 : next;
      });
    }, 1000);
  }

  function closeClaimWindow() {
    setClaimWindowSecondsLeft(0);
    if (claimWindowTimer.current) window.clearInterval(claimWindowTimer.current);
    claimWindowTimer.current = null;
  }

  // Admin actions (MVP local)
  function adminNewGame() {
    setStatus("OPEN");
    setCalledNumbers([]);
    setSelectedCards([]);
    setEnteredCards([]); // ✅ reset paid entries
    setEntriesLocked(false);
    setLastEntrySig("");
    setLastEntryTotalSol(0);

    setWinners([]);
    setClaimResult(null);
    setInvalidStrikes(0);
    setLastClaimAt(0);
    setClaimWindowOpenAt(null);
    closeClaimWindow();
  }

  function adminLockGameStart() {
    setStatus("LOCKED");
    setClaimResult(null);
    setWinners([]);
    setInvalidStrikes(0);
    setLastClaimAt(0);
    setClaimWindowOpenAt(null);
    closeClaimWindow();
  }

  function adminPauseToggle() {
    if (status === "LOCKED") setStatus("PAUSED");
    else if (status === "PAUSED") setStatus("LOCKED");
  }

  function adminEndGame() {
    setStatus("ENDED");
    closeClaimWindow();
  }

  function adminCloseAndIncrement() {
    setGameNumber((n) => n + 1);
    setStatus("CLOSED");
    setCalledNumbers([]);
    setSelectedCards([]);
    setEnteredCards([]); // ✅ reset paid entries
    setEntriesLocked(false);
    setLastEntrySig("");
    setLastEntryTotalSol(0);

    setWinners([]);
    setClaimResult(null);
    setInvalidStrikes(0);
    setLastClaimAt(0);
    setClaimWindowOpenAt(null);
    closeClaimWindow();
  }

  function adminCallNumber(n: number) {
    if (status !== "LOCKED" && status !== "PAUSED") return;
    setCalledNumbers((prev) => {
      const next = uniquePush(prev, n);
      if (claimWindowOpenAt) closeClaimWindow(); // next number called closes window
      return next;
    });
    setClaimResult(null);
  }

  function adminUndo() {
    if (status !== "LOCKED" && status !== "PAUSED") return;
    setCalledNumbers((prev) => removeLast(prev));
    setClaimResult(null);
  }

  // Player actions
  function toggleSelectCard(card: BingoCard) {
    if (status !== "OPEN") return;
    if (entriesLocked) return; // ✅ can’t change after paying

    setSelectedCards((prev) => {
      const exists = prev.some((c) => c.id === card.id);
      if (exists) return prev.filter((c) => c.id !== card.id);
      if (prev.length >= maxCards) return prev;
      return [...prev, card];
    });
  }

  async function handlePayAndLockEntries() {
    if (status !== "OPEN") return;

    if (!wallet.connected || !wallet.publicKey) {
      setClaimResult({ result: "REJECTED", message: "Connect your wallet first." });
      return;
    }

    if (!wallet.signTransaction) {
      setClaimResult({ result: "REJECTED", message: "Wallet cannot sign transactions (signTransaction missing)." });
      return;
    }

    if (entriesLocked) {
      setClaimResult({ result: "REJECTED", message: "Entries already locked for this game." });
      return;
    }

    if (selectedCards.length === 0) {
      setClaimResult({ result: "REJECTED", message: "Select at least 1 card before entering." });
      return;
    }

    const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
    const pot = process.env.NEXT_PUBLIC_GAME_POT_WALLET?.trim();

    if (!rpc) {
      setClaimResult({ result: "REJECTED", message: "Missing NEXT_PUBLIC_SOLANA_RPC_URL" });
      return;
    }
    if (!pot) {
      setClaimResult({ result: "REJECTED", message: "Missing NEXT_PUBLIC_GAME_POT_WALLET" });
      return;
    }

    let potPk: PublicKey;
    try {
      potPk = new PublicKey(pot);
    } catch {
      setClaimResult({ result: "REJECTED", message: "NEXT_PUBLIC_GAME_POT_WALLET is not a valid public key." });
      return;
    }

    const count = selectedCards.length;
    const totalSol = entryFeeSol * count;

    // Safety: don’t allow 0-fee entries
    if (!(totalSol > 0)) {
      setClaimResult({ result: "REJECTED", message: "Entry fee must be greater than 0." });
      return;
    }

    const lamports = Math.round(totalSol * 1_000_000_000);

    setPaying(true);
    setClaimResult(null);

    try {
      const connection = new Connection(rpc, "confirmed");

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: potPk,
          lamports,
        })
      );

      tx.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;

      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
  skipPreflight: false,
  maxRetries: 3,
});

// ✅ Confirm without websockets (no signatureSubscribe)
await confirmSignatureByPolling(connection, sig, 60_000);


      // ✅ only now do we count them in pots
      setEnteredCards(selectedCards);
      setEntriesLocked(true);
      setLastEntrySig(sig);
      setLastEntryTotalSol(totalSol);

      // Persist entry on backend so pots/entries are cumulative across all wallets
      try {
        await fetchJson<ServerGameState>("/api/game/enter", {
          method: "POST",
          body: JSON.stringify({
            wallet: wallet.publicKey.toBase58(),
            signature: sig,
            totalSol,
            cardIds: selectedCards.map((c) => c.id),
          }),
        });
      } catch (e: any) {
        // Surface server error (do not pretend entry succeeded for shared state)
        setClaimResult({
          result: "REJECTED",
          message: e?.message ? `Entry save failed: ${e.message}` : "Entry save failed.",
        });
        setEnteredCards([]);
        setEntriesLocked(false);
        return;
      }

      setClaimResult({
        result: "ACCEPTED",
        message: `Payment confirmed. Entered ${count} card(s) for Game #${gameNumber}. Tx: ${sig}`,
      });
    } catch (e: any) {
      setClaimResult({
        result: "REJECTED",
        message: e?.message ? `Payment failed: ${e.message}` : "Payment failed.",
      });
    } finally {
      setPaying(false);
    }
  }
  // Pots are server-derived (cumulative across all connected wallets)
  const entriesCount = serverEntriesCount;
  const totalPot = serverTotalPotSol;

  const playerSeriesPot = serverPlayerPotSol;
  const foundersBonus = serverFoundersBonusSol;
  const foundersSeriesPot = serverFoundersPotSol;
  const jackpotPot = serverJackpotSol;

  // Derived: winning cards (use paid entries once locked; fallback to selected for admin testing)
  const activeEntries = entriesLocked ? enteredCards : selectedCards;

  const winningCards = useMemo(() => {
    if (status !== "LOCKED" && status !== "PAUSED") return [];
    return activeEntries.filter((c) => isWinningByType(gameType, c.grid, calledSet));
  }, [activeEntries, calledSet, status, gameType]);

  const canClaimBingo = useMemo(() => {
    if (status !== "LOCKED" && status !== "PAUSED") return false;
    if (winningCards.length === 0) return false;
    if (invalidStrikes >= 3) return false;

    const now = Date.now();
    if (now - lastClaimAt < 10_000) return false;

    // If game is paused for claim review, allow additional claims only inside the shared window
    if (status === "PAUSED") {
      if (!claimWindowEndsAt) return false;
      if (now > claimWindowEndsAt) return false;
    }

    return true;
  }, [status, winningCards, invalidStrikes, lastClaimAt, claimWindowEndsAt]);

  
  async function handleCallBingo() {
    if (!canClaimBingo) return;

    const now = Date.now();
    setLastClaimAt(now);
    setClaiming(true);
    setClaimResult(null);

    const eligible = winningCards.filter((c) => !winners.some((w) => w.cardId === c.id));
    if (eligible.length === 0) {
      setInvalidStrikes((s) => s + 1);
      setClaimResult({ result: "REJECTED", message: "No eligible winning cards (already claimed or none winning)." });
      setClaiming(false);
      return;
    }

    const claimedCard = eligible[0];

    try {
      await fetchJson<ServerGameState>("/api/game/claim", {
        method: "POST",
        body: JSON.stringify({
          wallet: walletAddress,
          cardId: claimedCard.id,
        }),
      });

      setClaimResult({
        result: "ACCEPTED",
        message: `BINGO claim submitted for ${claimedCard.label}. Host is verifying now.`,
      });
      // The server will pause the game and open a shared 60s claim window for everyone.
    } catch (e: any) {
      setInvalidStrikes((s) => s + 1);
      setClaimResult({
        result: "REJECTED",
        message: e?.message ? `Claim rejected: ${e.message}` : "Claim rejected.",
      });
    } finally {
      setClaiming(false);
    }
  }

  // Payout preview (fair model)
  const payoutPreview = useMemo(() => {
    const totalWinners = winners.length;
    if (totalWinners === 0) return null;

    const foundersWinners = winners.filter((w) => w.isFounders).length;
    const perWinnerBase = totalWinners > 0 ? playerSeriesPot / totalWinners : 0;

    const perFounderBonus =
      foundersWinners > 0
        ? foundersBonus / foundersWinners // split founders 5% across founders winners
        : 0;

    return {
      totalWinners,
      foundersWinners,
      perWinnerBase,
      perFounderBonus,
    };
  }, [winners, playerSeriesPot, foundersBonus]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900">NFTBingo — Play</h1>
            <div className="text-sm text-slate-600 mt-1">
              Game #{gameNumber} • <span className="font-semibold">{gameTypeLabel(gameType)}</span> • Status:{" "}
              <span className="font-semibold">{status}</span>
            </div>
          </div>

          {isAdmin ? (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-900 text-white">ADMIN</span>
          ) : null}
        </div>

        {/* Pots */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <PotCard title="Player Series Pot" value={`${formatSol(playerSeriesPot)} SOL`} />
          <PotCard title="Founders Series Pot" value={`${formatSol(foundersSeriesPot)} SOL`} />
          <PotCard title="Progressive Jackpot" value={`${formatSol(jackpotPot)} SOL`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Left main */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow p-6 md:p-8">
            <h2 className="text-2xl font-bold text-slate-900">Join & Play</h2>
            <p className="text-slate-700 mt-1">
              Entry fee is set by the admin per game. You can enter up to {maxCards} cards.
            </p>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-600">Entry Fee (per card)</div>
                <div className="text-xl font-extrabold text-slate-900">{formatSol(entryFeeSol)} SOL</div>
              </div>

              <div className="text-sm text-slate-600">
                Selected entries: <span className="font-semibold text-slate-900">{selectedCards.length}</span>
                <div className="text-xs text-slate-500 mt-1">
                  Paid entries: <span className="font-semibold text-slate-900">{enteredCards.length}</span>
                  {entriesLocked ? " (locked)" : ""}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Select your card(s)</h3>
              <p className="text-sm text-slate-600">
                Cards load from your connected wallet (Founders / Players). If your wallet is not connected, demo cards
                are shown.
              </p>

              {cardsLoading ? (
                <div className="mt-4 text-sm text-slate-600">Loading your cards…</div>
              ) : cardsError ? (
                <div className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  {cardsError}
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(wallet.connected && walletCards.length ? walletCards : walletCards).map((card) => {
                  const selected = selectedCards.some((c) => c.id === card.id);
                  const disabled = status !== "OPEN" || entriesLocked;

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => toggleSelectCard(card)}
                      disabled={disabled}
                      className={[
                        "w-full text-left rounded-xl border p-4 transition",
                        selected ? "border-pink-500 bg-pink-50" : "border-slate-200 bg-white hover:bg-slate-50",
                        disabled ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">{card.label}</div>
                          <div className="text-xs text-slate-600 mt-1">
                            Type:{" "}
                            <span className={card.type === "FOUNDERS" ? "text-indigo-700 font-semibold" : "text-slate-700 font-semibold"}>
                              {card.type === "FOUNDERS" ? "Founders Series" : "Player Series"}
                            </span>
                          </div>
                        </div>
                        <span
                          className={[
                            "text-xs px-2 py-1 rounded-full",
                            selected ? "bg-pink-600 text-white" : "bg-slate-200 text-slate-700",
                          ].join(" ")}
                        >
                          {selected ? "Selected" : "Select"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pay + enter */}
            <div className="flex flex-col md:flex-row md:items-center gap-3 mt-6 mb-8">
              <button
                type="button"
                onClick={handlePayAndLockEntries}
                disabled={status !== "OPEN" || selectedCards.length === 0 || entriesLocked || paying}
                className={[
                  "cursor-pointer bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-6 py-3 rounded-xl shadow-md transition-all",
                  "hover:opacity-95 hover:shadow-lg active:scale-[0.99]",
                  status !== "OPEN" || selectedCards.length === 0 || entriesLocked || paying ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {paying ? "Paying…" : entriesLocked ? "Entered (Locked)" : "Pay & Enter Game"}
              </button>

              <div className="text-sm text-slate-600">
                Status must be <span className="font-semibold text-slate-900">OPEN</span> to enter.
                {lastEntrySig ? (
                  <div className="text-xs text-slate-500 mt-1">
                    Last entry: {formatSol(lastEntryTotalSol)} SOL • Tx:{" "}
                    <span className="font-mono">{lastEntrySig}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Called numbers + card view */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card preview */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Your card view</h3>
                <p className="text-sm text-slate-600 mb-4">Numbers auto-mark as they’re called. Free space is always marked.</p>

                {activeEntries.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-xl p-6 text-slate-600 bg-slate-50">
                    Select card(s) above to see your grid here.
                  </div>
                ) : (
                  <CardCarousel cards={activeEntries} calledSet={calledSet} gameType={gameType} />
                )}
              </div>

              {/* Called list */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Called numbers</h3>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">Last called</div>
                    <div className="text-2xl font-extrabold text-slate-900">
                      {calledNumbers.length ? calledNumbers[calledNumbers.length - 1] : "—"}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-sm text-slate-600 mb-2">History</div>
                    <div className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-sm">
                      {calledNumbers.length === 0 ? (
                        <div className="text-slate-500">No numbers called yet.</div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {calledNumbers.map((n) => (
                            <span key={n} className="px-2 py-1 rounded-lg bg-slate-100 text-slate-800">
                              {n}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Claim window */}
                  <div className="mt-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Claim window</span>
                      <span className="font-semibold text-slate-900">
                        {claimWindowOpenAt ? `${claimWindowSecondsLeft}s` : "—"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Closes on next called number or 60s.</div>
                  </div>

                  {/* Claim button */}
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={handleCallBingo}
                      disabled={!canClaimBingo || claiming}
                      className={[
                        "w-full cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-6 py-3 rounded-xl shadow-md transition-all",
                        "hover:opacity-95 hover:shadow-lg active:scale-[0.99]",
                        !canClaimBingo || claiming ? "opacity-50 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      {winningCards.length > 0 ? "CALL BINGO" : "CALL BINGO (locked)"}
                    </button>

                    <div className="mt-2 text-xs text-slate-500">
                      Invalid strikes: <span className="font-semibold text-slate-900">{invalidStrikes}</span>/3 • Cooldown: 10s
                    </div>
                  </div>

                  {/* Result */}
                  {claimResult && (
                    <div
                      className={[
                        "mt-4 rounded-xl p-3 text-sm border break-all whitespace-normal",
                        claimResult.result === "ACCEPTED"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                          : "bg-rose-50 border-rose-200 text-rose-900",
                      ].join(" ")}
                    >
                      {claimResult.message}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Winners */}
            <div className="mt-8 border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Winners (local MVP)</h3>
              {winners.length === 0 ? (
                <p className="text-sm text-slate-600">No winners recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-slate-700">
                    Winners recorded: <span className="font-semibold text-slate-900">{winners.length}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-2">
                      {winners.map((w, idx) => (
                        <div key={`${w.cardId}-${idx}`} className="flex items-center justify-between text-sm">
                          <span className="text-slate-800">
                            {w.isFounders ? "⭐ Founders" : "🎫 Player"} — {w.cardId}
                          </span>
                          <span className="text-xs text-slate-500">{w.wallet}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {payoutPreview && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <div className="font-semibold text-slate-900 mb-2">Payout preview (fair model)</div>
                      <div className="text-slate-700">
                        Each winner base share:{" "}
                        <span className="font-semibold text-slate-900">{formatSol(payoutPreview.perWinnerBase)} SOL</span>
                      </div>
                      <div className="text-slate-700 mt-1">
                        Founders winners:{" "}
                        <span className="font-semibold text-slate-900">{payoutPreview.foundersWinners}</span>{" "}
                        {payoutPreview.foundersWinners > 0 ? (
                          <>
                            • Each founders bonus:{" "}
                            <span className="font-semibold text-slate-900">{formatSol(payoutPreview.perFounderBonus)} SOL</span>
                          </>
                        ) : (
                          <>• No founders bonus paid</>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Admin panel (ADMIN ONLY) */}
          {isAdmin ? (
            <div className="bg-white rounded-2xl shadow p-6 md:p-8">
              <h2 className="text-2xl font-bold text-slate-900">Controls</h2>
              <p className="text-slate-700 mt-1">Admin controls (mirror-click numbers + manage the game).</p>

              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-600">Entry Fee (SOL)</div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={entryFeeSol}
                      disabled={status === "LOCKED" || status === "PAUSED"}
                      onChange={(e) => setEntryFeeSol(clamp(parseFloat(e.target.value || "0"), 0, 100))}
                      className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                    />
                    <span className="text-sm text-slate-600">per card</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">Locked once the game starts (LOCKED/PAUSED).</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-600">Game Type</div>
                  <select
                    value={gameType}
                    disabled={status === "LOCKED" || status === "PAUSED"}
                    onChange={(e) => setGameType(e.target.value as GameType)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="FOUR_CORNERS">4 Corners</option>
                    <option value="BLACKOUT">Blackout</option>
                  </select>
                  <div className="text-xs text-slate-500 mt-2">Locked once the game starts (LOCKED/PAUSED).</div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={adminNewGame}
                    className="cursor-pointer bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow-md transition-all hover:opacity-95"
                  >
                    Open Game (signups)
                  </button>

                  <button
                    type="button"
                    onClick={adminLockGameStart}
                    disabled={status !== "OPEN"}
                    className={[
                      "cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow-md transition-all hover:opacity-95",
                      status !== "OPEN" ? "opacity-50 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    Lock & Start Game
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={adminPauseToggle}
                      disabled={status !== "LOCKED" && status !== "PAUSED"}
                      className={[
                        "flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900 hover:bg-slate-50",
                        status !== "LOCKED" && status !== "PAUSED" ? "opacity-50 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      {status === "PAUSED" ? "Resume" : "Pause"}
                    </button>

                    <button
                      type="button"
                      onClick={adminEndGame}
                      disabled={status !== "LOCKED" && status !== "PAUSED"}
                      className={[
                        "flex-1 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 font-semibold text-rose-800 hover:bg-rose-100",
                        status !== "LOCKED" && status !== "PAUSED" ? "opacity-50 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      End Game
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={adminCloseAndIncrement}
                    disabled={status !== "ENDED"}
                    className={[
                      "rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900 hover:bg-slate-50",
                      status !== "ENDED" ? "opacity-50 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    Close & Next Game (+1)
                  </button>
                </div>
              </div>

              <div className="mt-8 border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-slate-900">Mirror-click calls</h3>
                  <button
                    type="button"
                    onClick={adminUndo}
                    disabled={(status !== "LOCKED" && status !== "PAUSED") || calledNumbers.length === 0}
                    className={[
                      "rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-900 hover:bg-slate-50",
                      (status !== "LOCKED" && status !== "PAUSED") || calledNumbers.length === 0
                        ? "opacity-50 cursor-not-allowed"
                        : "",
                    ].join(" ")}
                  >
                    Undo last
                  </button>
                </div>

                <div className="grid grid-cols-10 gap-2">
                  {Array.from({ length: 75 }, (_, i) => i + 1).map((n) => {
                    const picked = calledSet.has(n);
                    const disabled = (status !== "LOCKED" && status !== "PAUSED") || picked;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => adminCallNumber(n)}
                        disabled={disabled}
                        className={[
                          "rounded-lg px-2 py-2 text-xs font-semibold border transition-all",
                          picked
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50",
                          disabled && !picked ? "opacity-40 cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-10 text-xs text-slate-500">
          MVP note: Pots only increase after “Pay & Enter” confirms on-chain. Next step is wiring backend entry records + payouts.
        </div>
      </div>
    </main>
  );
}