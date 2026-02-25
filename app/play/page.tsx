"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";


// Collections allowed to play (from env)
const FOUNDERS_COLLECTION_MINT = (process.env.NEXT_PUBLIC_FOUNDERS_COLLECTION_MINT || "").trim();
const PLAYER_SERIES_COLLECTION_MINT = (process.env.NEXT_PUBLIC_PLAYER_SERIES_COLLECTION_MINT || "").trim();
const VIP_COLLECTION_MINT = (process.env.NEXT_PUBLIC_VIP_COLLECTION_MINT || "").trim();

const eqPk = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const shortAddr = (s?: string, n = 4) => {
  if (!s) return "";
  const t = s.trim();
  if (t.length <= n * 2 + 3) return t;
  return `${t.slice(0, n)}…${t.slice(-n)}`;
};

const getCollectionMint = (c: any): string => {
  // Support a few common shapes depending on indexer/API
  const v =
    c?.collectionMint ??
    c?.collection_mint ??
    c?.collectionAddress ??
    c?.collection_address ??
    c?.collection ??
    c?.collectionId ??
    c?.collection_id ??
    c?.metadata?.collection ??
    c?.onchain?.collection ??
    "";
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    return String(v.mint ?? v.address ?? v.key ?? "");
  }
  return "";
};

type CardType = "PLAYER" | "FOUNDERS";

type BingoCard = {
  id: string; // mint
  label: string;
  type: CardType;
  grid: number[][]; // 5x5, center FREE = 0
  imageUrl?: string | null; // NFT art (optional)
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


function letterForNumber(n: number): "B" | "I" | "N" | "G" | "O" {
  // Standard bingo ranges: B 1-15, I 16-30, N 31-45, G 46-60, O 61-75
  if (n <= 15) return "B";
  if (n <= 30) return "I";
  if (n <= 45) return "N";
  if (n <= 60) return "G";
  return "O";
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
    <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.35)] p-5">
      <div className="text-sm text-white/70">{title}</div>
      <div className="mt-2 text-2xl font-extrabold text-white">{value}</div>
    </div>
  );
}

function gameTypeLabel(t: GameType) {
  if (t === "STANDARD") return "Standard";
  if (t === "FOUR_CORNERS") return "4 Corners";
  return "Blackout";
}



function pickImageUrl(cardLike: any): string | null {
  // Try a few common shapes returned by NFT indexers (Helius, Metaplex, custom APIs).
  const direct =
    cardLike?.imageUrl ||
    cardLike?.image ||
    cardLike?.img ||
    cardLike?.art ||
    cardLike?.content?.links?.image ||
    cardLike?.content?.metadata?.image ||
    cardLike?.content?.json?.image ||
    cardLike?.metadata?.image;

  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const files = cardLike?.content?.files;
  if (Array.isArray(files) && files.length) {
    const u = files.find((f: any) => typeof f?.uri === "string" && f.uri.trim())?.uri;
    if (typeof u === "string" && u.trim()) return u.trim();
  }

  return null;
}

function BingoCardArt({
  card,
  calledSet,
}: {
  card: BingoCard;
  calledSet: Set<number>;
}) {
  // The NFT art already has the numbers printed.
  // We only overlay marker "balls" for called numbers (and the FREE center).
  const grid = card.grid;
  const img = card.imageUrl || null;

  /**
   * Marker calibration (percentages of the rendered image box).
   * These values define the rectangle that contains the 5x5 number squares
   * on your NFT card art.
   *
   * If you ever need micro-adjustments:
   * - Increase left/right to move markers inward/outward horizontally.
   * - Increase top/bottom to move markers downward/upward vertically.
   */
  const GRID_LEFT = 0.0905;
  const GRID_RIGHT = 0.915;
  const GRID_TOP = 0.455;
  const GRID_BOTTOM = 0.972;

  // Small per-art calibration (helps align the FREE center square perfectly)
  const FREE_OFFSET_X = 0.000;
  const FREE_OFFSET_Y = 0.000;

  const cellW = (GRID_RIGHT - GRID_LEFT) / 5;
  const cellH = (GRID_BOTTOM - GRID_TOP) / 5;

  return (
    <div className="w-full">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-[0_12px_35px_rgba(0,0,0,0.35)]">
        {img ? (
          <img
            src={img}
            alt={card.label}
            className="absolute inset-0 h-full w-full object-contain"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.35),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.28),transparent_55%),radial-gradient(circle_at_50%_85%,rgba(236,72,153,0.22),transparent_55%)]" />
        )}

        {/* Marker balls ONLY (no fog overlay, no duplicate numbers) */}
        <div className="absolute inset-0 pointer-events-none">
          {grid.flatMap((row, r) =>
            row.map((v, c) => {
              const isFree = r === 2 && c === 2;
              const isCalled = !isFree && v !== 0 && calledSet.has(v);
              if (!isFree && !isCalled) return null;

              let cx = GRID_LEFT + (c + 0.5) * cellW;
              let cy = GRID_TOP + (r + 0.5) * cellH;
              if (isFree) {
                cx += FREE_OFFSET_X;
                cy += FREE_OFFSET_Y;
              }

              return (
                <span
                  key={`${r}-${c}`}
                  className="absolute bingo-ball-mini"
                  style={{
                    left: `${cx * 100}%`,
                    top: `${cy * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  title={isFree ? "FREE" : `${v}`}
                  aria-label={isFree ? "FREE" : `${v}`}
                />
              );
})
          )}
        </div>
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

  // Keep the user on the same card when the cards array is refreshed (e.g., after each call/state poll).
  // We track the current card's stable id and restore the index if that card still exists.
  const activeCardIdRef = useRef<string | null>(null);

  useEffect(() => {
    const current = cards[idx];
    if (current?.id) activeCardIdRef.current = current.id;
  }, [cards, idx]);

  useEffect(() => {
    if (!cards.length) {
      setIdx(0);
      return;
    }
    const wanted = activeCardIdRef.current;
    if (wanted) {
      const found = cards.findIndex((c) => c.id === wanted);
      if (found >= 0 && found !== idx) {
        setIdx(found);
        return;
      }
    }
    // Clamp without hard-resetting to 0 unless needed.
    if (idx >= cards.length) setIdx(cards.length - 1);
  }, [cards]);

  const card = cards[idx];
  const isWin = isWinningByType(gameType, card.grid, calledSet);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.35)] p-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-semibold text-white">{card.label}</div>
          <div className="text-xs text-white/65 mt-1">
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

      <BingoCardArt card={card} calledSet={calledSet} />

      {cards.length > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIdx((i) => (i - 1 + cards.length) % cards.length)}
            className="rounded-lg border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white hover:bg-white/15"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % cards.length)}
            className="rounded-lg border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white hover:bg-white/15"
          >
            Next
          </button>
        </div>
      )}

      <div className="mt-3 text-xs text-slate-500">
        Game type: <span className="font-semibold text-white">{gameTypeLabel(gameType)}</span>
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

async function fetchJson<T>(url: string, init?: (RequestInit & { timeoutMs?: number })): Promise<T> {
  const anyInit: any = init || {};
  const timeoutMs: number = typeof anyInit.timeoutMs === "number" ? anyInit.timeoutMs : 12_000;

  const method = String(anyInit.method || "GET").toUpperCase();
  const finalUrl =
    method === "GET" || method === "HEAD"
      ? `${url}${url.includes("?") ? "&" : "?"}_ts=${Date.now()}`
      : url;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(finalUrl, {
      ...anyInit,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(anyInit.headers || {}) },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as any)?.error || (data as any)?.message || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data as T;
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Request timed out. Please try again.");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}



export default function PlayPage() {
  // Game config
  const [gameNumber, setGameNumber] = useState<number>(1);
  const [gameType, setGameType] = useState<GameType>("STANDARD");
  const [status, setStatus] = useState<GameStatus>("CLOSED");

  // Entry pricing
  const [entryFeeSol, setEntryFeeSol] = useState<number>(0.05);
  const feeEditingRef = useRef(false);
  // When admins change the entry fee, the 1.5s server poll can "snap" the input back to the
  // previous server value before the backend write lands. Track the most recent local fee edit
  // and prefer it briefly until the server reflects the same value.
  const feeLocalOverrideRef = useRef<{ value: number; at: number } | null>(null);

  const feeSaveTimerRef = useRef<number | null>(null);
  const feeLastSentRef = useRef<number>(-1);
  const typeEditingRef = useRef(false);

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

  // Wallet inventory (fetched from /api/cards/owned)
  const [walletCards, setWalletCards] = useState<BingoCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState<boolean>(false);
  const [cardsError, setCardsError] = useState<string>("");
  const [cardsRefreshNonce, setCardsRefreshNonce] = useState<number>(0);
  const refreshCards = () => setCardsRefreshNonce((n) => n + 1);

  const ownedCardsAbortRef = useRef<AbortController | null>(null);


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


  const applyServerState = (s: ServerGameState) => {
    setGameNumber(s.gameNumber);
    if (!typeEditingRef.current) setGameType(s.gameType);
    setStatus(s.status);
    if (!feeEditingRef.current) {
      const local = feeLocalOverrideRef.current;
      if (local) {
        const age = Date.now() - local.at;
        const serverFee = typeof s.entryFeeSol === "number" ? s.entryFeeSol : Number((s as any).entryFeeSol);
        // If server has caught up (or value is effectively the same), clear the override.
        if (Number.isFinite(serverFee) && Math.abs(serverFee - local.value) < 1e-9) {
          feeLocalOverrideRef.current = null;
          setEntryFeeSol(serverFee);
        } else if (age < 8000) {
          // Keep showing the locally edited value for a short window.
          setEntryFeeSol(local.value);
        } else {
          // Give up after a few seconds and trust the server again.
          feeLocalOverrideRef.current = null;
          setEntryFeeSol(serverFee);
        }
      } else {
        setEntryFeeSol(s.entryFeeSol);
      }
    }
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
    // Preserve wallet-specific "my" state unless the server explicitly includes it.
    // Some admin endpoints may return the global game state without the `my` field, which would otherwise
    // wipe local wallet UI (Pay button state, selected/entered indicators) and cause a full-page "flash".
    if (s.my && Array.isArray((s as any).my.enteredCardIds)) {
      setEnteredCardIds((s as any).my.enteredCardIds);
      setLastEntrySig(String((s as any).my.lastSig || ""));
      if (typeof (s as any).my.lastTotalSol === "number") setLastEntryTotalSol((s as any).my.lastTotalSol);
      setEntriesLocked((((s as any).my.enteredCardIds?.length) || 0) > 0);
    } else if (Object.prototype.hasOwnProperty.call(s as any, "my")) {
      // If the server explicitly says there is no `my` state, clear it.
      setEnteredCardIds([]);
      setEntriesLocked(false);
      setLastEntrySig("");
      setLastEntryTotalSol(0);
    }
  };

  const postAdmin = async (body: any) => {
    const res = await fetchJson<ServerGameState>("/api/game/admin", {
      method: "POST",
      body: JSON.stringify(body),
    });
    applyServerState(res);
    return res;
  };

  const queueFeeSave = (nextFee: number, immediate = false) => {
    // Mark this value as locally edited so the server poll doesn’t immediately overwrite it.
    if (Number.isFinite(nextFee)) {
      feeLocalOverrideRef.current = { value: nextFee, at: Date.now() };
    }

    // Avoid spamming identical values
    if (Number.isFinite(nextFee) && feeLastSentRef.current === nextFee && !immediate) return;

    if (feeSaveTimerRef.current) {
      window.clearTimeout(feeSaveTimerRef.current);
      feeSaveTimerRef.current = null;
    }

    const run = async () => {
      try {
        feeLastSentRef.current = nextFee;
        await postAdmin({
          action: "SET_FEE",
          // send multiple aliases so backend can't miss it
          entryFeeSol: nextFee,
          feeSol: nextFee,
          fee: nextFee,
          buyInSol: nextFee,
          buyIn: nextFee,
        });
      } catch (e: any) {
        setClaimResult({ result: "REJECTED", message: e?.message || "Failed to set entry fee." });
      }
    };

    if (immediate) {
      void run();
      return;
    }

    feeSaveTimerRef.current = window.setTimeout(() => {
      feeSaveTimerRef.current = null;
      void run();
    }, 650);
  };



  // ✅ Sync game state for everyone (server truth)
  useEffect(() => {
    let timer: any = null;
    let stopped = false;

    const tick = async () => {
      if ((tick as any)._inFlight) return;
      (tick as any)._inFlight = true;

      try {
        const qs = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : "";
        const s = await fetchJson<ServerGameState>(`/api/game/state${qs}`, { timeoutMs: 10_000 });
        if (stopped) return;

        applyServerState(s);
      } catch {
        // ignore poll failures
      } finally {
        (tick as any)._inFlight = false;
      }
    };

    tick();
    timer = setInterval(tick, 1500);

    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    const onFocus = () => tick();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [walletAddress]);



  // Fetch wallet cards from server (allowed collections only)
  useEffect(() => {
    let cancelled = false;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    async function run() {
      // If disconnected, clear inventory and any stale errors/loading.
      if (!wallet.connected || !walletAddress) {
        setWalletCards([]);
        setCardsError("");
        setCardsLoading(false);
        return;
      }

      const cacheKey = `nftbingo:ownedCards:${walletAddress}`;
      const TTL_MS = 5 * 60 * 1000;

      const readCache = (): BingoCard[] | null => {
        try {
          const raw = localStorage.getItem(cacheKey);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object") return null;
          const ts = Number(parsed.ts || 0);
          if (!ts || Date.now() - ts > TTL_MS) return null;
          const cards = Array.isArray(parsed.cards) ? (parsed.cards as BingoCard[]) : null;
          return cards && cards.length ? cards : null;
        } catch {
          return null;
        }
      };

      const writeCache = (cards: BingoCard[]) => {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), cards }));
        } catch {
          // ignore storage quota / private mode
        }
      };

      const cached = readCache();
      if (cached && !cancelled) {
        // Immediately show cached cards to avoid a blank/placeholder state.
        setWalletCards(cached);
        setCardsError("");
      }

      // Only show the "Loading..." text when we don't already have cards.
      if (!cancelled) setCardsLoading(!(cached && cached.length));

      setCardsError("");

      try { ownedCardsAbortRef.current?.abort(); } catch {}
      ownedCardsAbortRef.current = null;

      const fetchWithRetry = async () => {
  const baseUrl = `/api/cards/owned?owner=${encodeURIComponent(walletAddress)}`;
  let lastErr: any = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (cancelled) throw new Error("Cancelled");

    // NEW controller per attempt (prevents “stuck aborted” retries)
    const attemptController = new AbortController();
    ownedCardsAbortRef.current = attemptController;

    const t = setTimeout(() => attemptController.abort(), 30_000);

    try {
      const url = `${baseUrl}&_ts=${Date.now()}`; // fresh timestamp each attempt
      const res = await fetch(url, { cache: "no-store", signal: attemptController.signal });

      if (res.status === 429) {
        const wait = 600 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
        await sleep(wait);
        lastErr = new Error("Rate limited (429).");
        continue;
      }

      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || `Failed to load cards (${res.status})`);
      if (!j?.ok) throw new Error(j?.error || "Failed to load cards");
      return j;
    } catch (e: any) {
      lastErr = e;

      // If it aborted, don’t instantly hammer again; backoff a bit.
      await sleep(250 * Math.pow(2, attempt));
    } finally {
      clearTimeout(t);
    }
  }

  throw lastErr || new Error("Failed to load cards");
};

      try {
        const j = await fetchWithRetry();
        ownedCardsAbortRef.current = null;
        const owned: any[] = Array.isArray(j.cards) ? j.cards : [];

        // If the API returns extra NFTs, keep only collections we allow (when collection mint is available).
        const allowedMints = [FOUNDERS_COLLECTION_MINT, PLAYER_SERIES_COLLECTION_MINT, VIP_COLLECTION_MINT].filter(Boolean);

        const filteredOwned = owned.filter((c) => {
          const cm = getCollectionMint(c);
          if (!cm) return true; // can't verify; keep (fallback heuristics may classify)
          if (!allowedMints.length) return true;
          return allowedMints.some((m) => eqPk(cm, m));
        });

        const mapped: BingoCard[] = filteredOwned.map((c) => {

          // Be defensive: different indexers/APIs may return "Founders", "Founders Series",
          // or only provide a tier like "Platinum"/"Gold"/"Silver".
          const seriesRaw = String(c.series ?? c.cardSeries ?? c.collection ?? "");
          const tierRaw = String(
            c.tier ??
              c.attributes?.find?.((a: any) => a?.trait_type === "Tier")?.value ??
              ""
          );

          
          const collectionMint = getCollectionMint(c);

          // Source of truth: collection mint (preferred).
          // Falls back to metadata heuristics only if collection mint is missing.
          const isFoundersByCollection =
            !!FOUNDERS_COLLECTION_MINT && eqPk(collectionMint, FOUNDERS_COLLECTION_MINT);

          // Optional: treat VIP as founders-style bonus if you want (currently NOT counted as founders).
          // const isVipByCollection = !!VIP_COLLECTION_MINT && eqPk(collectionMint, VIP_COLLECTION_MINT);

          const isFoundersByMeta =
            /founder/i.test(seriesRaw) ||
            /platinum|gold|silver/i.test(tierRaw) ||
            /founder/i.test(String(c.name ?? "")) ||
            /founder/i.test(String(c.symbol ?? ""));

          const isFounders = isFoundersByCollection || (!collectionMint && isFoundersByMeta);

          const type: CardType = isFounders ? "FOUNDERS" : "PLAYER";


          const grid =
            numbersByLetterToGrid(c.numbersByLetter) ||
            demoCard(c.name || `${type} Card`, type, mintToSeed(String(c.mint || ""))).grid;

          return {
            id: String(c.mint || ""),
            label: String(c.name || (type === "FOUNDERS" ? "Founders Series" : "Player Series")),
            type,
            grid,
            imageUrl: pickImageUrl(c),
          };
        });

        if (!cancelled) {
          setWalletCards(mapped);
          writeCache(mapped);

          if (!mapped.length) setCardsError("No eligible NFTBingo cards found in this wallet.");
        }
      } catch (e: any) {
        if (cancelled) return;

        // Mobile wallet webviews (especially Phantom) can abort requests when backgrounded.
        const isAbort =
          e?.name === "AbortError" ||
          String(e?.message || "").toLowerCase().includes("aborted") ||
          String(e?.message || "").toLowerCase().includes("abort");

        const msg = isAbort ? "Connection interrupted. Please tap Refresh Cards and try again." : (e?.message ?? "Failed to load cards");

        if (cached && cached.length) {
          setCardsError("If you are unable to see your cards, please click the Refresh Cards button above. If that doesn't work, try refreshing the page.");
        } else {
          setCardsError(msg);
        }
      } finally {
        if (!cancelled) setCardsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      try { ownedCardsAbortRef.current?.abort(); } catch {}
    };
  }, [wallet.connected, walletAddress, cardsRefreshNonce]);
  // When walletCards refresh, keep selected/entered card objects in sync so imageUrl updates
  useEffect(() => {
    if (!walletCards.length) return;
    const byId = new Map(walletCards.map((c) => [c.id, c]));
    setSelectedCards((prev) => prev.map((c) => byId.get(c.id) || c));
    setEnteredCards((prev) => prev.map((c) => byId.get(c.id) || c));
  }, [walletCards]);


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

      // Admin actions (server-backed)
    async function adminNewGame() {
      try {
        await postAdmin({ action: "NEW_GAME" });
        setClaimResult(null);
        closeClaimWindow();
      } catch (e: any) {
        setClaimResult({ result: "REJECTED", message: e?.message || "Failed to open game." });
      }
    }

    async function adminLockGameStart() {
      try {
        await postAdmin({ action: "LOCK" });
        setClaimResult(null);
        closeClaimWindow();
      } catch (e: any) {
        setClaimResult({ result: "REJECTED", message: e?.message || "Failed to lock/start game." });
      }
    }

    async function adminPauseToggle() {
      try {
        await postAdmin({ action: "PAUSE_TOGGLE" });
      } catch (e: any) {
        setClaimResult({ result: "REJECTED", message: e?.message || "Failed to pause/resume." });
      }
    }

    async function adminEndGame() {
      try {
        await postAdmin({ action: "END" });
        closeClaimWindow();
      } catch (e: any) {
        setClaimResult({ result: "REJECTED", message: e?.message || "Failed to end game." });
      }
    }

    async function adminCloseAndIncrement() {
      try {
        await postAdmin({ action: "CLOSE_NEXT" });
        closeClaimWindow();
      } catch (e: any) {
        setClaimResult({ result: "REJECTED", message: e?.message || "Failed to close & next." });
      }
    }


    async function adminResetProgressive() {
      try {
        await postAdmin({ action: "RESET_PROGRESSIVE" });
        setClaimResult(null);
      } catch (e: any) {
        setClaimResult({ result: "REJECTED", message: e?.message || "Failed to reset progressive jackpot." });
      }
    }


    async function adminCallNumber(n: number) {
      if (status !== "LOCKED" && status !== "PAUSED") return;
      try {
        await postAdmin({ action: "CALL_NUMBER", number: n });
        if (claimWindowOpenAt) closeClaimWindow();
        setClaimResult(null);
      } catch (e: any) {
        setClaimResult({ result: "REJECTED", message: e?.message || "Failed to call number." });
      }
    }

    async function adminUndo() {
      if (status !== "LOCKED" && status !== "PAUSED") return;
      try {
        await postAdmin({ action: "UNDO_LAST" });
        setClaimResult(null);
      } catch (e: any) {
        setClaimResult({ result: "REJECTED", message: e?.message || "Failed to undo last." });
      }
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
            // Optional hints so backend can correctly attribute Founders vs Player cards without extra on-chain lookups.
            // Backend should ignore if unused.
            cardMeta: selectedCards.map((c) => ({ cardId: c.id, type: c.type })),
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

  // Auto-select entered card(s) for viewing (mobile UX)
  // Players shouldn't have to tap "Select" after the game locks; show their entered grid automatically.
  useEffect(() => {
    if (!enteredCardIds.length) return;
    if (selectedCards.length) return;

    const entered = walletCards.filter((c) => enteredCardIds.includes(c.id));
    if (entered.length) setSelectedCards(entered);
  }, [enteredCardIds, walletCards, selectedCards.length]);

  // ✅ Rehydrate paid/entered cards after refresh (player re-opens page mid-game)
  // Server remembers enteredCardIds, but the client must map them back to full card objects once walletCards load.
  useEffect(() => {
    if (!wallet.connected || !walletAddress) {
      setEnteredCards([]);
      return;
    }
    if (!enteredCardIds.length) {
      setEnteredCards([]);
      return;
    }

    const entered = walletCards.filter((c) => enteredCardIds.includes(c.id));
    // If walletCards haven't loaded yet, keep previous enteredCards until we can resolve them.
    if (entered.length) setEnteredCards(entered);
  }, [wallet.connected, walletAddress, enteredCardIds, walletCards]);




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
          // Optional hints so backend can correctly attribute Founders vs Player cards.
          // Backend should ignore if unused.
          cardType: claimedCard.type,
          isFounders: claimedCard.type === "FOUNDERS",
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
    <main className="min-h-screen nbg-game-bg">
      <div aria-hidden="true" className="nbg-bg-layers">
        <div className="nbg-bg-orb nbg-orb-1" />
        <div className="nbg-bg-orb nbg-orb-2" />
        <div className="nbg-bg-orb nbg-orb-3" />
        <div className="nbg-bg-grid" />
        <div className="nbg-bg-vignette" />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 py-8">
        <header className="mb-6 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4 md:px-6">
            <div className="flex items-center gap-3">
              <div className="nbg-logo-wrap">
                <Image
                  src="/images/NFTBingoLogo.png"
                  alt="NFTBingo"
                  width={180}
                  height={52}
                  priority
                  className="nbg-logo-img"
                />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">NFTBingo</h1>
                  {isAdmin ? (
                    <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/30">ADMIN</span>
                  ) : null}
                </div>
                <div className="text-xs md:text-sm text-white/70">
                  Game #{gameNumber} • {gameTypeLabel(gameType)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <div className="nbg-pill">
                <div className="nbg-pill-label">GAME STATUS</div>
                <div className="nbg-pill-value">{status}</div>
              </div>

              <div className="nbg-pill">
                <div className="nbg-pill-label">PLAYERS POT</div>
                <div className="nbg-pill-value">{formatSol(playerSeriesPot)} SOL</div>
              </div>

              <div className="nbg-pill">
                <div className="nbg-pill-label">FOUNDERS POT</div>
                <div className="nbg-pill-value">{formatSol(foundersSeriesPot)} SOL</div>
              </div>

              <div className="nbg-pill nbg-pill-jackpot">
                <div className="nbg-pill-label">MEGA JACKPOT</div>
                <div className="nbg-pill-value">{formatSol(jackpotPot)} SOL</div>
              </div>
</div>
          </div>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Left main */}
          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.35)] p-6 md:p-8">
            <h2 className="text-2xl font-bold text-white">Join & Play</h2>
            <p className="text-white/80 mt-1">
              Entry fees are set before the game starts. You can enter up to {maxCards} cards per game with additional entry fees for each card entered.
            </p>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4 flex items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
              <div>
                <div className="text-sm text-white/70">Entry Fee (per card)</div>
                <div className="text-xl font-extrabold text-white">{formatSol(entryFeeSol)} SOL</div>
              </div>

              <div className="text-sm text-white/80">
                Selected entries: <span className="font-semibold text-white">{selectedCards.length}</span>
                <div className="text-xs text-white/60 mt-1 break-words">
                  Paid entries: <span className="font-semibold text-white">{enteredCards.length}</span>
                  {entriesLocked ? " (locked)" : ""}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="text-lg font-semibold text-white">Select your card(s)</h3>
                <button
                  type="button"
                  onClick={refreshCards}
                  className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  aria-label="Refresh cards"
                >
                  Refresh Cards
                </button>
              </div>
              <p className="text-sm text-white/65">
                Connect your wallet on top of the page. Owned Players or Founders Series cards will be shown here. Choose the ones you wish to play with, pay your entry fee, and they’ll be locked in for this game. You can get Founders or Players Series cards at NFTBingo.net/mint on our site.
                </p>

              {!wallet.connected ? (
                <div className="mt-4 text-sm text-white/65">Connect your wallet to load your NFTBingo cards.</div>
              ) : null}

              {cardsLoading ? (
                <div className="mt-4 text-sm text-white/65">Loading your cards…</div>
              ) : cardsError ? (
                <div className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  {cardsError}
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {wallet.connected && !cardsLoading && !cardsError && walletCards.length === 0 ? (
                  <div className="text-sm text-white/65">
                    No cards loaded yet. Tap <span className="font-semibold">Refresh cards</span> above, or try again in a moment.
                  </div>
                ) : null}

                {walletCards.map((card) => {
                  const selected = selectedCards.some((c) => c.id === card.id);
                  const isEntered = enteredCardIds.includes(card.id);
                  const disabled = (status !== "OPEN" || entriesLocked) && !isEntered;

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => toggleSelectCard(card)}
                      disabled={disabled}
                      className={[
                        "w-full text-left rounded-xl border p-4 transition backdrop-blur-md",
                        selected ? "border-pink-400/60 bg-pink-500/15 shadow-[0_0_0_1px_rgba(236,72,153,0.25)]" : "border-white/10 bg-white/5 hover:bg-white/8",
                        disabled ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-white">{card.label}</div>
                          <div className="text-xs text-white/65 mt-1">
                            Type:{" "}
                            <span className={card.type === "FOUNDERS" ? "text-indigo-200 font-semibold" : "text-slate-200 font-semibold"}>
                              {card.type === "FOUNDERS" ? "Founders Series" : "Player Series"}
                            </span>
                          </div>
                        </div>
                        <span
                          className={[
                            "text-xs px-2 py-1 rounded-full",
                            selected ? "bg-pink-600 text-white" : "bg-white/10 text-white/80 border border-white/10",
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
                {paying ? "Paying…" : entriesLocked ? "Entered Successfully (Locked)" : "Pay & Enter Game"}
              </button>

              <div className="text-sm text-white/65">
                Games can only be entered when they are showing the status as <span className="font-semibold text-white">OPEN</span>.
                {lastEntrySig ? (
                  <div className="text-xs text-white/60 mt-1 break-words">
                    Last entry: {formatSol(lastEntryTotalSol)} SOL • Tx:{" "}
                    <span className="font-mono break-all">{lastEntrySig}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Called numbers + card view */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card preview */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Your card view</h3>
                <p className="text-sm text-white/65 mb-4">Your card's numbers will be auto-marked for you as they are called. Free space always counts as marked. The Call Bingo button will unlock when your cards have the correct pattern based on the numbers drawn.</p>

                {activeEntries.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-6 text-white/70">
                    Select card(s) above to see your grid(s) here.
                  </div>
                ) : (
                  <CardCarousel cards={activeEntries} calledSet={calledSet} gameType={gameType} />
                )}
              </div>

              {/* Called list */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Called numbers</h3>
                <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-white/65">Last # called</div>
                    <div className="text-2xl font-extrabold text-white">
                      {calledNumbers.length ? calledNumbers[calledNumbers.length - 1] : "—"}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-sm text-white/65 mb-2">History</div>
                    <div className="max-h-40 overflow-auto rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                      {calledNumbers.length === 0 ? (
                        <div className="text-white/55">No numbers called yet.</div>
                      ) : (
                        <div>
                          <div className="mb-3 flex flex-wrap items-center gap-3">
                            <div className="text-xs font-semibold text-white/65">Last call</div>
                            <div className="bingo-ball text-lg font-black">
                              {calledNumbers[calledNumbers.length - 1]}
                            </div>
                            <div className="text-xs text-slate-500">
                              ({letterForNumber(calledNumbers[calledNumbers.length - 1])})
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {calledNumbers.map((n) => (
                              <span key={n} className="bingo-ball-mini" title={`${letterForNumber(n)}${n}`}>
                                {n}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Claim window */}
                  <div className="mt-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-white/65">Claim window</span>
                      <span className="font-semibold text-white">
                        {claimWindowOpenAt ? `${claimWindowSecondsLeft}s` : "—"}
                      </span>
                    </div>
                    <div className="text-xs text-white/60 mt-1 break-words">Claim window closes after the next number is called or 60 seconds after a winning Bingo has been verified.</div>
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
                      Invalid strikes: <span className="font-semibold text-white">{invalidStrikes}</span>/3 • Cooldown: 10s
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
            <div className="mt-8 border-t border-white/10 pt-6">
              <h3 className="text-lg font-semibold text-white mb-2">BINGO! Winners</h3>
              {winners.length === 0 ? (
                <p className="text-sm text-white/65">No winners recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-white/70">
                    Winners recorded: <span className="font-semibold text-white">{winners.length}</span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                    <div className="flex flex-col gap-2">
                      {winners.map((w, idx) => (
                        <div
                          key={`${w.cardId}-${idx}`}
                          className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm"
                        >
                          <div className="font-semibold text-white mb-2">
                            {w.isFounders ? "⭐ Founders" : "🎫 Player"} —
                          </div>

                          <div className="mb-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-500">Card Token ID</div>
                            <div className="font-mono text-white break-all">{w.cardId}</div>
                          </div>

                          {isAdmin ? (
                            <div>
                              <div className="text-[11px] uppercase tracking-wide text-slate-500">Wallet</div>
                              <div className="font-mono text-white break-all">{w.wallet}</div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  {payoutPreview && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                      <div className="font-semibold text-white mb-2">Payout preview (fair model)</div>
                      <div className="text-white/80">
                        Each winner base share:{" "}
                        <span className="font-semibold text-white">{formatSol(payoutPreview.perWinnerBase)} SOL</span>
                      </div>
                      <div className="text-white/80 mt-1">
                        Founders winners:{" "}
                        <span className="font-semibold text-white">{payoutPreview.foundersWinners}</span>{" "}
                        {payoutPreview.foundersWinners > 0 ? (
                          <>
                            • Each founders bonus:{" "}
                            <span className="font-semibold text-white">{formatSol(payoutPreview.perFounderBonus)} SOL</span>
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
            <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.35)] p-6 md:p-8">
              <h2 className="text-2xl font-bold text-white">Controls</h2>
              <p className="text-white/70 mt-1">Admin controls (mirror-click numbers + manage the game).</p>

              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-white/65">Entry Fee (SOL)</div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={entryFeeSol}
                      disabled={status === "LOCKED" || status === "PAUSED"}
                      onFocus={() => {
                        feeEditingRef.current = true;
                      }}
                      onBlur={(e) => {
                        feeEditingRef.current = false;
                        const v = clamp(parseFloat((e.target as HTMLInputElement).value || "0"), 0, 100);
                        setEntryFeeSol(v);
                        queueFeeSave(v, true);
                      }}
                      onChange={(e) => {
                        feeEditingRef.current = true;
                        const v = clamp(parseFloat(e.target.value || "0"), 0, 100);
                        setEntryFeeSol(v);
                        // Save shortly after changes so arrows/typing persist even without blur
                        if (status === "OPEN" || status === "CLOSED") queueFeeSave(v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.currentTarget as HTMLInputElement).blur();
                        }
                      }}
                      className="w-32 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                    />
                    <span className="text-sm text-white/65">per card</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">Locked once the game starts (LOCKED/PAUSED).</div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-white/65">Game Type</div>
                  <select
                    value={gameType}
                    disabled={status === "LOCKED" || status === "PAUSED"}
                    onFocus={() => {
                     typeEditingRef.current = true;
                   }}
                   onBlur={() => {
                     typeEditingRef.current = false;
                   }}
                   onChange={async (e) => {
                     const next = e.target.value as GameType;
                     setGameType(next);
                     try {
                       await postAdmin({ action: "SET_TYPE", gameType: next });
                     } catch (err: any) {
                       setClaimResult({ result: "REJECTED", message: err?.message || "Failed to set game type." });
                     }
                   }}
                    className="mt-2 w-full rounded-lg border border-white/15 bg-slate/10 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
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
                        "flex-1 rounded-xl border border-white/15 bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/15",
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
                      "rounded-xl border border-white/15 bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/15",
                      status !== "ENDED" ? "opacity-50 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    Close & Next Game (+1)
                  </button>


                  <button
                    type="button"
                    onClick={adminResetProgressive}
                    disabled={status === "LOCKED" || status === "PAUSED"}
                    className={[
                      "rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 font-semibold text-rose-800 hover:bg-rose-100",
                      status === "LOCKED" || status === "PAUSED" ? "opacity-50 cursor-not-allowed" : "",
                    ].join(" ")}
                    title="Resets the Progressive Jackpot back to 0 (does not affect current game pots)."
                  >
                    Reset Progressive Jackpot
                  </button>

                </div>
              </div>

              <div className="mt-8 border-t border-white/10 pt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-white">Mirror-click calls</h3>
                  <button
                    type="button"
                    onClick={adminUndo}
                    disabled={(status !== "LOCKED" && status !== "PAUSED") || calledNumbers.length === 0}
                    className={[
                      "rounded-lg border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white hover:bg-white/15",
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
                          "rounded-lg aspect-square flex items-center justify-center px-0 py-0 text-xs font-semibold leading-none border transition-all",
                          picked
                            ? "bg-slate-900 text-white border-white/20"
                            : "bg-white/10 text-white border-white/15 hover:bg-white/15",
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

        <div className="mt-18 text-xs text-white/60 text-center max-w-4xl mx-auto leading-relaxed">
          MVP note: This game system is in early Alpha and is considered Minimum Viable Product. NFTBingo is continuously working to upgrade the game system and migrate all functionality to our gaming site. Potential bugs and issues should be reported to support@nftbingo.net. • Current Release Version 1.0.9-alpha
        </div>
      </div>

      <style jsx global>{`
        :root{
          --nbg-glow: rgba(99,102,241,0.55);
          --nbg-glow2: rgba(16,185,129,0.35);
          --nbg-glow3: rgba(236,72,153,0.25);
        }
        .nbg-game-bg{
          background: radial-gradient(1200px 700px at 15% 15%, rgba(99,102,241,0.25), transparent 55%),
                      radial-gradient(1100px 650px at 85% 20%, rgba(16,185,129,0.22), transparent 55%),
                      radial-gradient(900px 600px at 55% 90%, rgba(236,72,153,0.18), transparent 55%),
                      linear-gradient(180deg, #070A12 0%, #090B17 55%, #070A12 100%);
          color-scheme: dark;
        }
        .nbg-bg-layers{
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .nbg-bg-orb{
          position: absolute;
          width: 720px;
          height: 720px;
          border-radius: 9999px;
          filter: blur(40px);
          opacity: 0.55;
          transform: translateZ(0);
          animation: nbgFloat 12s ease-in-out infinite;
        }
        .nbg-orb-1{ left:-220px; top:-240px; background: var(--nbg-glow); animation-delay: -2s; }
        .nbg-orb-2{ right:-260px; top:-220px; background: var(--nbg-glow2); animation-delay: -5s; }
        .nbg-orb-3{ left: 25%; bottom:-420px; background: var(--nbg-glow3); animation-delay: -8s; }
        .nbg-bg-grid{
          position: absolute;
          inset: -2px;
          background-image:
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(circle at 50% 30%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 50%, transparent 78%);
          opacity: 0.35;
        }
        .nbg-bg-vignette{
          position:absolute;
          inset:0;
          background: radial-gradient(circle at 50% 40%, transparent 0%, rgba(0,0,0,0.55) 72%, rgba(0,0,0,0.75) 100%);
        }
        @keyframes nbgFloat{
          0%,100%{ transform: translate3d(0,0,0) scale(1); }
          50%{ transform: translate3d(0,-18px,0) scale(1.03); }
        }
        .nbg-logo-badge{
          width: 44px;
          height: 44px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(99,102,241,0.85), rgba(16,185,129,0.65));
          box-shadow: 0 12px 35px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.14) inset;
          display:flex;
          align-items:center;
          justify-content:center;
        }
        .nbg-logo-badge-inner{
          font-weight: 900;
          color: white;
          letter-spacing: -0.02em;
          font-size: 20px;
          text-shadow: 0 8px 18px rgba(0,0,0,0.35);
          user-select:none;
        }
        .nbg-logo-wrap{
          height: 44px;
          display:flex;
          align-items:center;
        }
        .nbg-logo-img{
          height: 44px;
          width: auto;
          filter: drop-shadow(0 10px 22px rgba(0,0,0,0.45));
          user-select:none;
        }
        .nbg-pill{
          border-radius: 9999px;
          padding: 10px 12px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(12px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.25);
          min-width: 150px;
        }
        .nbg-pill-label{
          font-size: 10px;
          opacity: 0.7;
          letter-spacing: 0.12em;
          font-weight: 800;
        }
        .nbg-pill-value{
          font-size: 13px;
          font-weight: 800;
          margin-top: 2px;
          color: rgba(255,255,255,0.95);
        }
        .nbg-pill-jackpot{
          box-shadow: 0 18px 40px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.12) inset, 0 0 30px rgba(236,72,153,0.16);
        }
        /* Make default inputs/buttons feel more "gamey" */
        button{
          transform: translateZ(0);
        }
        button:active{
          transform: translateY(1px);
        }

        /* Bingo balls (ensure readable on dark UI) */
        .bingo-ball{
          width: 64px;
          height: 64px;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.96);
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 55%, rgba(0,0,0,0.22) 100%);
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: 0 16px 35px rgba(0,0,0,0.45);
        }
        .bingo-ball-mini{
          width: 34px;
          height: 34px;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 12px;
          line-height: 1;
          color: rgba(255,255,255,0.98);
          /* Stained-glass mark: high contrast on top of card art */
          background: radial-gradient(circle at 30% 28%,
  rgba(255,255,255,0.85) 0%,
  rgba(255,255,255,0.45) 18%,
  rgba(236,72,153,0.85) 35%,
  rgba(59,130,246,0.75) 80%,
  rgba(0,0,0,0.65) 100%);
          border: 1px solid rgba(255,255,255,0.28);
          box-shadow:
            0 0 0 2px rgba(236,72,153,0.14),
            0 0 18px rgba(236,72,153,0.22),
            0 0 18px rgba(59,130,246,0.18),
            0 10px 22px rgba(0,0,0,0.40);
        }
      `}</style>

    </main>
  );
}