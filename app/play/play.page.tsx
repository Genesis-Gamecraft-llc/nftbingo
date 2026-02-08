"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

/**
 * MVP: /play page
 * - Local state driven (works without backend)
 * - Has clear TODOs for API wiring
 *
 * IMPORTANT:
 * - Now loads wallet NFTs from /api/cards/owned and supports Founders/Player/VIP.
 * - Entries can be multi-selected and charge per card (single tx for total).
 */

type GameType = "STANDARD" | "FOUR_CORNERS" | "BLACKOUT";
type GameStatus = "CLOSED" | "OPEN" | "LOCKED" | "PAUSED" | "ENDED";

type CardType = "PLAYER" | "FOUNDERS" | "VIP";

type BingoCard = {
  id: string; // mint address (real)
  label: string;
  type: CardType;
  grid: number[][]; // 5x5, center may be 0 for FREE
};

type ClaimResult = "ACCEPTED" | "REJECTED";

// Founders collection address (provided)
const FOUNDERS_COLLECTION = "JBg3RkePxmRYjb6b4qLQ93EatBpW8cFboc3aGW2oGDpn";

// Collections (from env; used for UI labels only — server route filters allowed collections)
const PLAYER_COLLECTION = process.env.NEXT_PUBLIC_PLAYER_SERIES_COLLECTION_MINT || "";
const VIP_COLLECTION = process.env.NEXT_PUBLIC_VIP_COLLECTION_MINT || "";

// Entry destination wallet (set in env)
const GAME_POT_WALLET = process.env.NEXT_PUBLIC_GAME_POT_WALLET || "";

// RPC (prefer proxy or provided public RPC)
const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC ||
  "https://api.mainnet-beta.solana.com";

function mintToSeed(mint: string): number {
  // stable-ish seed from mint string
  let h = 2166136261;
  for (let i = 0; i < mint.length; i++) {
    h ^= mint.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1_000_000;
}

function numbersByLetterToGrid(numbersByLetter: Record<string, number[]> | undefined): number[][] | null {
  if (!numbersByLetter) return null;

  const letters = ["B", "I", "N", "G", "O"];
  const cols: number[][] = letters.map((L) => {
    const arr = (numbersByLetter as any)[L] || (numbersByLetter as any)[L.toLowerCase()] || [];
    return Array.isArray(arr) ? arr.map((x) => Number(x)) : [];
  });

  // need at least 5 numbers per col (N can be 4 with free space)
  for (let c = 0; c < 5; c++) {
    if (c === 2) {
      // N column: allow 4 or 5
      if (cols[c].length < 4) return null;
    } else {
      if (cols[c].length < 5) return null;
    }
  }

  const grid = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 2 && c === 2) {
        grid[r][c] = 0; // free space
      } else if (c === 2 && cols[c].length === 4) {
        // N has 4 values: skip center
        const idx = r < 2 ? r : r - 1;
        grid[r][c] = cols[c][idx] ?? 0;
      } else {
        grid[r][c] = cols[c][r] ?? 0;
      }
    }
  }
  return grid;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetries<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      await sleep(250 * (i + 1));
    }
  }
  throw lastErr;
}

/** ===== Helpers ===== */

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
  const value = grid[r][c];
  return calledSet.has(value);
}

function hasStandardBingo(grid: number[][], calledSet: Set<number>): boolean {
  // rows
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

  // cols
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

  // diagonals
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

/** ===== Demo cards (fallback only) ===== */

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

/** ===== UI components ===== */

function Pill({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1 rounded-full text-sm font-medium transition",
        active ? "bg-pink-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function PotCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 border border-slate-100">
      <div className="text-sm text-slate-600">{title}</div>
      <div className="text-2xl font-extrabold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function MiniGrid({ grid, calledSet }: { grid: number[][]; calledSet: Set<number> }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {grid.map((row, r) =>
        row.map((n, c) => {
          const marked = cellMarked(grid, calledSet, r, c);
          return (
            <div
              key={`${r}-${c}`}
              className={[
                "h-8 flex items-center justify-center rounded-md text-xs font-semibold border",
                isFreeCell(r, c)
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : marked
                    ? "bg-indigo-50 border-indigo-200 text-indigo-800"
                    : "bg-white border-slate-200 text-slate-700",
              ].join(" ")}
            >
              {isFreeCell(r, c) ? "FREE" : n}
            </div>
          );
        })
      )}
    </div>
  );
}

function CardCarousel({ cards, calledSet, gameType }: { cards: BingoCard[]; calledSet: Set<number>; gameType: GameType }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [cards.length]);

  if (cards.length === 0) return null;

  const current = cards[clamp(idx, 0, cards.length - 1)];
  const isWinning = isWinningByType(gameType, current.grid, calledSet);

  return (
    <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="font-bold text-slate-900 truncate">{current.label}</div>
          <div className="text-xs text-slate-600">
            Type:{" "}
            <span
              className={
                current.type === "FOUNDERS"
                  ? "text-indigo-700 font-semibold"
                  : current.type === "VIP"
                    ? "text-amber-700 font-semibold"
                    : "text-slate-700 font-semibold"
              }
            >
              {current.type === "FOUNDERS" ? "Founders Series" : current.type === "VIP" ? "VIP Series" : "Player Series"}
            </span>
            {isWinning ? <span className="ml-2 text-emerald-700 font-semibold">— WINNING</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIdx((v) => clamp(v - 1, 0, cards.length - 1))}
            disabled={idx === 0}
            className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setIdx((v) => clamp(v + 1, 0, cards.length - 1))}
            disabled={idx === cards.length - 1}
            className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <MiniGrid grid={current.grid} calledSet={calledSet} />

      <div className="mt-3 text-xs text-slate-500">
        Card ID (mint): <span className="font-mono">{current.id}</span>
      </div>
    </div>
  );
}

/** ===== Page ===== */

export default function PlayPage() {
  // Game config
  const [gameNumber, setGameNumber] = useState<number>(1);
  const [gameType, setGameType] = useState<GameType>("STANDARD");
  const [status, setStatus] = useState<GameStatus>("CLOSED");

  // Entry pricing
  const [entryFeeSol, setEntryFeeSol] = useState<number>(0.05);

  // Called numbers (MVP: mirror-click admin)
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const calledSet = useMemo(() => new Set(calledNumbers), [calledNumbers]);

  // Selected/entered cards
  const [selectedCards, setSelectedCards] = useState<BingoCard[]>([]);
  const [maxCards] = useState<number>(5);

  // Wallet inventory (fetched from /api/cards/owned; falls back to demo if not connected)
  const [walletCards, setWalletCards] = useState<BingoCard[]>(() => [
    demoCard("Founders Series Card (Demo)", "FOUNDERS", 41),
    demoCard("VIP Series Card (Demo)", "VIP", 77),
    demoCard("Player Series Card (Demo)", "PLAYER", 101),
  ]);
  const [cardsLoading, setCardsLoading] = useState<boolean>(false);
  const [cardsError, setCardsError] = useState<string>("");

  // Payment/entry lock for this game (prevents swapping cards after paying)
  const [entriesLocked, setEntriesLocked] = useState<boolean>(false);
  const [lastEntrySig, setLastEntrySig] = useState<string>("");
  const [lastEntryTotalSol, setLastEntryTotalSol] = useState<number>(0);

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
        const res = await fetch(
  `/api/cards/owned?owner=${encodeURIComponent(walletAddress)}&t=${Date.now()}`,
  { cache: "no-store" }
);

        const j = await res.json();
        if (!j?.ok) throw new Error(j?.error || "Failed to load cards");

        const owned: any[] = Array.isArray(j.cards) ? j.cards : [];

        const mapped: BingoCard[] = owned.map((c) => {
          const series = String(c.series || "").toUpperCase();
          const type: CardType = series === "FOUNDERS" ? "FOUNDERS" : series === "VIP" ? "VIP" : "PLAYER";

          const grid =
            numbersByLetterToGrid(c.numbersByLetter) ||
            demoCard(c.name || `${type} Card`, type, mintToSeed(String(c.mint || ""))).grid;

          return {
            id: String(c.mint || ""),
            label: String(
              c.name ||
                (type === "FOUNDERS" ? "Founders Series" : type === "VIP" ? "VIP Series" : "Player Series")
            ),
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

  // Derived: entries count & pots
  const entriesCount = selectedCards.length;
  const totalPot = entriesCount * entryFeeSol;

  const playerSeriesPot = totalPot * 0.75;
  const foundersBonus = totalPot * 0.05;
  const foundersSeriesPot = playerSeriesPot + foundersBonus; // 80%
  const jackpotPot = totalPot * 0.05;

  // Derived: winning cards
  const winningCards = useMemo(() => {
    if (status !== "LOCKED" && status !== "PAUSED") return [];
    return selectedCards.filter((c) => isWinningByType(gameType, c.grid, calledSet));
  }, [selectedCards, calledSet, status, gameType]);

  const canClaimBingo = useMemo(() => {
    if (status !== "LOCKED" && status !== "PAUSED") return false;
    if (winningCards.length === 0) return false;
    if (invalidStrikes >= 3) return false;

    const now = Date.now();
    if (now - lastClaimAt < 10_000) return false;

    if (claimWindowOpenAt && claimWindowSecondsLeft <= 0) return false;

    return true;
  }, [status, winningCards, invalidStrikes, lastClaimAt, claimWindowOpenAt, claimWindowSecondsLeft]);

  useEffect(() => {
    if ((status === "LOCKED" || status === "PAUSED") && winningCards.length > 0 && claimWindowOpenAt == null) {
      openClaimWindow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, winningCards.length]);

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
    setEntriesLocked(false);
    setLastEntrySig("");
    setLastEntryTotalSol(0);
    setCalledNumbers([]);
    setSelectedCards([]);
    setWinners([]);
    setClaimResult(null);
    setInvalidStrikes(0);
    setLastClaimAt(0);
    setClaimWindowOpenAt(null);
    closeClaimWindow();
  }

  function adminStartCalling() {
    if (status !== "OPEN") return;
    setStatus("LOCKED");
    setClaimResult(null);
  }

  function adminPause() {
    if (status !== "LOCKED") return;
    setStatus("PAUSED");
    setClaimResult(null);
  }

  function adminResume() {
    if (status !== "PAUSED") return;
    setStatus("LOCKED");
    setClaimResult(null);
  }

  function adminCloseGame() {
    setStatus("ENDED");
    setClaimResult(null);
    closeClaimWindow();
  }

  function adminNextGame() {
    setGameNumber((n) => n + 1);
    adminNewGame();
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
    if (entriesLocked) return;

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
      setClaimResult({ result: "REJECTED", message: "Your wallet does not support signTransaction." });
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

    if (!GAME_POT_WALLET) {
      setClaimResult({ result: "REJECTED", message: "Missing NEXT_PUBLIC_GAME_POT_WALLET in env." });
      return;
    }

    // MVP: one payment tx for all selected cards
    const totalSol = entryFeeSol * selectedCards.length;
    const lamports = Math.round(totalSol * 1_000_000_000);

    try {
      setClaiming(true);
      setClaimResult(null);

      const connection = new Connection(RPC_URL, "confirmed");
      const pot = new PublicKey(GAME_POT_WALLET);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: pot,
          lamports,
        })
      );
      tx.feePayer = wallet.publicKey;

      const { blockhash } = await withRetries(() => connection.getLatestBlockhash("confirmed"), 6);
      tx.recentBlockhash = blockhash;

      const signed = await wallet.signTransaction(tx);
      const sig = await withRetries(
        () => connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 6 }),
        6
      );

      await withRetries(() => connection.confirmTransaction(sig, "confirmed"), 6);

      setEntriesLocked(true);
      setLastEntrySig(sig);
      setLastEntryTotalSol(totalSol);

      setClaimResult({
        result: "ACCEPTED",
        message: `Payment confirmed. Entered ${selectedCards.length} card(s) for Game #${gameNumber}. Tx: ${sig}`,
      });
    } catch (e: any) {
      setClaimResult({ result: "REJECTED", message: e?.message ?? "Payment failed" });
    } finally {
      setClaiming(false);
    }
  }

  async function handleCallBingo() {
    if (!canClaimBingo) return;

    const now = Date.now();
    setLastClaimAt(now);
    setClaiming(true);
    setClaimResult(null);

    const eligible = winningCards.filter((c) => !winners.some((w) => w.cardId === c.id)); // one win per card
    if (eligible.length === 0) {
      setInvalidStrikes((s) => s + 1);
      setClaimResult({ result: "REJECTED", message: "No eligible winning cards (already won or none winning)." });
      setClaiming(false);
      return;
    }

    const claimedCard = eligible[0];
    const isFounders = claimedCard.type === "FOUNDERS" || claimedCard.type === "VIP";

    // TODO (backend):
    // POST /api/game/claim with gameNumber, walletAddress, cardId, gameType

    setWinners((prev) => [...prev, { cardId: claimedCard.id, wallet: walletAddress, isFounders }]);

    setClaimResult({
      result: "ACCEPTED",
      message: `Bingo claim accepted (MVP local). Card=${claimedCard.label}`,
    });

    setClaiming(false);
  }

  // Simple admin auth (kept from your page)
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const adminGate = process.env.NEXT_PUBLIC_NFTBINGO_ADMIN_PASSWORD || ""; // optional; if blank, uses local password field only

  function handleAdminLogin() {
    if (!adminGate) {
      // if no env set, allow any non-empty password locally for MVP
      if (adminPassword.trim().length > 0) setIsAdmin(true);
      return;
    }
    if (adminPassword.trim() === adminGate.trim()) setIsAdmin(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-10 pb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900">NFTBingo — Play</h1>
            <p className="text-slate-600 mt-1">
              Game #{gameNumber} •{" "}
              <span className="font-semibold text-slate-900">
                {gameType === "STANDARD" ? "Standard" : gameType === "FOUR_CORNERS" ? "4 Corners" : "Blackout"}
              </span>
              {" • "}
              Status: <span className="font-semibold text-slate-900">{status}</span>
            </p>
          </div>

          {!isAdmin && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 w-full md:w-[360px]">
              <div className="text-sm font-semibold text-slate-900 mb-2">Admin</div>
              <div className="flex items-center gap-2">
                <input
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  type="password"
                  placeholder="Password"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-300"
                />
                <button
                  type="button"
                  onClick={handleAdminLogin}
                  className="bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-95"
                >
                  Login
                </button>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Admin panel is hidden unless logged in.
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="flex items-center gap-3">
              <span className="text-xs px-3 py-1 rounded-full bg-slate-900 text-white">ADMIN</span>
            </div>
          )}
        </div>

        {/* Pots (no sublabels) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <PotCard title="Player Series Pot" value={`${formatSol(playerSeriesPot)} SOL`} />
          <PotCard title="Founders Series Pot" value={`${formatSol(foundersSeriesPot)} SOL`} />
          <PotCard title="Progressive Jackpot" value={`${formatSol(jackpotPot)} SOL`} />
        </div>

        {/* Main content grid */}
        <div className={isAdmin ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : "grid grid-cols-1 gap-6"}>
          {/* Left: Player actions */}
          <div className={isAdmin ? "lg:col-span-2 bg-white rounded-2xl shadow p-6 md:p-8" : "bg-white rounded-2xl shadow p-6 md:p-8"}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Join & Play</h2>
                <p className="text-slate-700">Entry fee is set by the admin per game. You can enter up to {maxCards} cards.</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Wallet:</span>
                <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">
                  {walletAddress || "Not connected"}
                </span>
              </div>
            </div>

            {/* Entry fee display */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
              <div>
                <div className="text-sm text-slate-600">Entry Fee (per card)</div>
                <div className="text-xl font-extrabold text-slate-900">{formatSol(entryFeeSol)} SOL</div>
              </div>
              <div className="text-sm text-slate-600">
                Selected entries: <span className="font-semibold text-slate-900">{entriesCount}</span>{" "}
                {entriesCount > 0 ? `(pay ${formatSol(entriesCount * entryFeeSol)} SOL)` : ""}
              </div>
            </div>

            {/* Card selection */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Select your card(s)</h3>
              <p className="text-sm text-slate-600 mb-4">
                Cards load from your connected wallet (Founders / Players / VIP). If your wallet is not connected, demo cards are shown.
              </p>

              {cardsLoading ? (
                <div className="mb-3 text-sm text-slate-600">Loading your cards…</div>
              ) : cardsError ? (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{cardsError}</div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {walletCards.map((card) => {
                  const selected = selectedCards.some((c) => c.id === card.id);
                  const disabled = status !== "OPEN" || entriesLocked || (!selected && selectedCards.length >= maxCards);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => toggleSelectCard(card)}
                      disabled={disabled}
                      className={[
                        "text-left border rounded-xl p-4 transition-all",
                        selected ? "border-pink-500 bg-pink-50" : "border-slate-200 bg-white hover:bg-slate-50",
                        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{card.label}</div>
                          <div className="text-xs text-slate-600 mt-1">
                            Type:{" "}
                            <span
                              className={
                                card.type === "FOUNDERS"
                                  ? "text-indigo-700 font-semibold"
                                  : card.type === "VIP"
                                    ? "text-amber-700 font-semibold"
                                    : "text-slate-700 font-semibold"
                              }
                            >
                              {card.type === "FOUNDERS" ? "Founders Series" : card.type === "VIP" ? "VIP Series" : "Player Series"}
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
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-8">
              <button
                type="button"
                onClick={handlePayAndLockEntries}
                disabled={status !== "OPEN" || selectedCards.length === 0 || entriesLocked || claiming}
                className={[
                  "cursor-pointer bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-6 py-3 rounded-xl shadow-md transition-all",
                  "hover:opacity-95 hover:shadow-lg active:scale-[0.99]",
                  status !== "OPEN" || selectedCards.length === 0 || entriesLocked || claiming ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {claiming ? "Processing…" : "Pay & Enter Game"}
              </button>

              <div className="text-sm text-slate-600">
                Status must be <span className="font-semibold text-slate-900">OPEN</span> to enter.
                {entriesLocked && lastEntryTotalSol > 0 ? (
                  <div className="mt-1 text-xs text-slate-500">Paid {formatSol(lastEntryTotalSol)} SOL for this game.</div>
                ) : null}
                {entriesLocked && lastEntrySig ? (
                  <div className="mt-1 text-xs text-slate-500 break-all">Tx: {lastEntrySig}</div>
                ) : null}
              </div>
            </div>

            {/* Called numbers + card view */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card preview */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Your card view</h3>
                <p className="text-sm text-slate-600 mb-4">Numbers auto-mark as they’re called. Free space is always marked.</p>

                {selectedCards.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-xl p-6 text-slate-600 bg-slate-50">
                    Select card(s) above to see your grid here.
                  </div>
                ) : (
                  <CardCarousel cards={selectedCards} calledSet={calledSet} gameType={gameType} />
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
                  {claimWindowOpenAt && (status === "LOCKED" || status === "PAUSED") ? (
                    <div className="mt-4 border border-amber-200 bg-amber-50 rounded-xl p-3">
                      <div className="text-sm font-semibold text-amber-900">Claim window</div>
                      <div className="text-sm text-amber-800">
                        {claimWindowSecondsLeft > 0 ? (
                          <>
                            You have <span className="font-semibold">{claimWindowSecondsLeft}s</span> to claim before the next number is called.
                          </>
                        ) : (
                          <>Claim window closed.</>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Call Bingo */}
            <div className="mt-8">
              <button
                type="button"
                onClick={handleCallBingo}
                disabled={!canClaimBingo || claiming}
                className={[
                  "w-full md:w-auto bg-slate-900 text-white font-semibold px-6 py-3 rounded-xl shadow transition",
                  canClaimBingo ? "hover:opacity-95" : "opacity-40 cursor-not-allowed",
                ].join(" ")}
              >
                {claiming ? "Submitting…" : "CALL BINGO"}
              </button>

              {invalidStrikes > 0 ? (
                <div className="text-xs text-rose-700 mt-2">
                  Invalid strikes: <span className="font-semibold">{invalidStrikes}</span> (3 strikes disables claims)
                </div>
              ) : null}

              {claimResult ? (
                <div
                  className={[
                    "mt-3 rounded-xl p-3 text-sm border",
                    claimResult.result === "ACCEPTED"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-rose-50 border-rose-200 text-rose-900",
                  ].join(" ")}
                >
                  {claimResult.message}
                </div>
              ) : null}
            </div>
          </div>

          {/* Right: Admin panel (unchanged structure, uses your existing actions) */}
          {isAdmin && (
            <div className="bg-white rounded-2xl shadow p-6 md:p-8 border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Admin Controls</h2>

              {/* Game type */}
              <div className="mb-4">
                <div className="text-sm text-slate-600 mb-2">Game type</div>
                <div className="flex flex-wrap gap-2">
                  <Pill label="Standard" active={gameType === "STANDARD"} onClick={() => setGameType("STANDARD")} />
                  <Pill label="4 Corners" active={gameType === "FOUR_CORNERS"} onClick={() => setGameType("FOUR_CORNERS")} />
                  <Pill label="Blackout" active={gameType === "BLACKOUT"} onClick={() => setGameType("BLACKOUT")} />
                </div>
              </div>

              {/* Entry fee */}
              <div className="mb-6">
                <div className="text-sm text-slate-600 mb-2">Entry fee (SOL per card)</div>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={entryFeeSol}
                  onChange={(e) => setEntryFeeSol(Math.max(0, Number(e.target.value)))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>

              {/* Game controls */}
              <div className="grid grid-cols-2 gap-2 mb-6">
                <button
                  type="button"
                  onClick={adminNewGame}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold px-3 py-2 rounded-xl"
                >
                  New Game (Open)
                </button>
                <button
                  type="button"
                  onClick={adminStartCalling}
                  className="bg-indigo-600 hover:opacity-95 text-white font-semibold px-3 py-2 rounded-xl"
                >
                  Lock & Start
                </button>

                <button
                  type="button"
                  onClick={adminPause}
                  className="bg-amber-500 hover:opacity-95 text-white font-semibold px-3 py-2 rounded-xl"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={adminResume}
                  className="bg-emerald-600 hover:opacity-95 text-white font-semibold px-3 py-2 rounded-xl"
                >
                  Resume
                </button>

                <button
                  type="button"
                  onClick={adminCloseGame}
                  className="bg-slate-900 hover:opacity-95 text-white font-semibold px-3 py-2 rounded-xl"
                >
                  End Game
                </button>
                <button
                  type="button"
                  onClick={adminNextGame}
                  className="bg-pink-600 hover:opacity-95 text-white font-semibold px-3 py-2 rounded-xl"
                >
                  Next Game #
                </button>
              </div>

              {/* Mirror-click controls */}
              <div className="mb-4">
                <div className="text-sm text-slate-600 mb-2">Mirror-click called number</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={75}
                    placeholder="1–75"
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const v = Number((e.target as HTMLInputElement).value);
                      if (!Number.isFinite(v)) return;
                      const n = clamp(Math.floor(v), 1, 75);
                      (e.target as HTMLInputElement).value = "";
                      adminCallNumber(n);
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-300"
                  />
                  <button
                    type="button"
                    onClick={adminUndo}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold px-3 py-2 rounded-xl whitespace-nowrap"
                  >
                    Undo
                  </button>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Tip: type the called number and press Enter.
                </div>
              </div>

              {/* Winners list */}
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900 mb-2">Winners (local MVP)</div>
                <div className="border border-slate-200 rounded-xl bg-slate-50 p-3 text-sm max-h-48 overflow-auto">
                  {winners.length === 0 ? (
                    <div className="text-slate-500">No winners yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {winners.map((w, i) => (
                        <div key={`${w.cardId}-${i}`} className="bg-white border border-slate-200 rounded-lg p-2">
                          <div className="text-xs text-slate-600">
                            Card: <span className="font-mono">{w.cardId}</span>
                          </div>
                          <div className="text-xs text-slate-600">
                            Wallet: <span className="font-mono">{w.wallet || "(unknown)"}</span>
                          </div>
                          <div className="text-xs">
                            Payout tier:{" "}
                            <span className={w.isFounders ? "text-indigo-700 font-semibold" : "text-slate-700 font-semibold"}>
                              {w.isFounders ? "Founders/VIP bonus" : "Standard"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Tomorrow MVP: payouts are manual. This list helps you audit.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
