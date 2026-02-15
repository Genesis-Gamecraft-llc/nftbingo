"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

type GameType = "STANDARD" | "FOUR_CORNERS" | "BLACKOUT";
type GameStatus = "CLOSED" | "OPEN" | "LOCKED" | "PAUSED" | "ENDED";

type CardType = "PLAYER" | "FOUNDERS";

type BingoCard = {
  id: string; // mint
  label: string;
  type: CardType;
  grid: number[][]; // 5x5, center FREE = 0
};

type ClaimResult = "ACCEPTED" | "REJECTED";

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

/** ===== Helpers ===== */

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

async function confirmSignatureByPolling(connection: Connection, signature: string, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
    const s = st?.value?.[0];
    if (s?.err) throw new Error(`Transaction failed: ${JSON.stringify(s.err)}`);
    if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") return;
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("Timed out confirming transaction (polling).");
}

function formatSol(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const s = n.toFixed(n >= 1 ? 3 : n >= 0.1 ? 4 : 5);
  return s.replace(/\.?0+$/, "");
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
    for (let c = 0; c < 5; c++) grid[r][c] = cols[c][r];
  }
  grid[2][2] = 0;

  return { id: `demo-${type}-${seed}`, label, type, grid };
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
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold">BINGO READY</span>
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

export default function PlayPage() {
  // Game config (server truth)
  const [serverGameId, setServerGameId] = useState<string>("");
  const lastServerGameId = useRef<string>("");

  const [gameNumber, setGameNumber] = useState<number>(1);
  const [gameType, setGameType] = useState<GameType>("STANDARD");
  const [status, setStatus] = useState<GameStatus>("CLOSED");
  const [entryFeeSol, setEntryFeeSol] = useState<number>(0.05);

  // Server-derived pots
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

  // Wallet-specific server entry info
  const [myEnteredIds, setMyEnteredIds] = useState<string[]>([]);
  const [entriesLocked, setEntriesLocked] = useState<boolean>(false);
  const [lastEntrySig, setLastEntrySig] = useState<string>("");
  const [lastEntryTotalSol, setLastEntryTotalSol] = useState<number>(0);

  // Called numbers + winners (server truth)
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const calledSet = useMemo(() => new Set(calledNumbers), [calledNumbers]);

  const [winners, setWinners] = useState<Array<{ cardId: string; wallet: string; isFounders: boolean }>>([]);

  // Selected/entered cards (client UX)
  const [selectedCards, setSelectedCards] = useState<BingoCard[]>([]);
  const [enteredCards, setEnteredCards] = useState<BingoCard[]>([]);
  const [maxCards] = useState<number>(5);

  // Wallet inventory
  const [walletCards, setWalletCards] = useState<BingoCard[]>(() => [
    demoCard("Founders Series Card (Demo)", "FOUNDERS", 41),
    demoCard("Player Series Card (Demo)", "PLAYER", 101),
  ]);
  const [cardsLoading, setCardsLoading] = useState<boolean>(false);
  const [cardsError, setCardsError] = useState<string>("");

  // Admin UI gating (cookie set elsewhere)
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

  // Wallet
  const wallet = useWallet();
  const walletAddress = useMemo(() => wallet.publicKey?.toBase58() || "", [wallet.publicKey]);

  function closeClaimWindow() {
    // claim window is server-driven now; local countdown is optional
    // (keeping function so we don't rewrite a bunch of JSX)
  }

  function applyServerState(s: ServerGameState) {
    // If a new game started server-side, reset client-only bits that should not carry across games
    if (lastServerGameId.current && s.gameId && lastServerGameId.current !== s.gameId) {
      setSelectedCards([]);
      setEnteredCards([]);
      setEntriesLocked(false);
      setLastEntrySig("");
      setLastEntryTotalSol(0);
      setClaimResult(null);
      setInvalidStrikes(0);
      setLastClaimAt(0);
      closeClaimWindow();
    }

    lastServerGameId.current = s.gameId;
    setServerGameId(s.gameId);

    setGameNumber(s.gameNumber);
    setGameType(s.gameType);
    setStatus(s.status);
    setEntryFeeSol(s.entryFeeSol);

    setCalledNumbers(Array.isArray(s.calledNumbers) ? s.calledNumbers : []);
    const serverWinners = Array.isArray(s.winners) ? s.winners : [];
    setWinners(serverWinners.map((w) => ({ cardId: w.cardId, wallet: w.wallet, isFounders: Boolean(w.isFounders) })));

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

    const mine = s.my?.enteredCardIds || [];
    setMyEnteredIds(mine);

    if (mine.length > 0) setEntriesLocked(true);
    if (typeof s.my?.lastSig === "string") setLastEntrySig(s.my.lastSig || "");
    if (typeof s.my?.lastTotalSol === "number") setLastEntryTotalSol(s.my.lastTotalSol || 0);
  }

  // Poll server state so game persists across refresh/devices
  const pollTimer = useRef<number | null>(null);
  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const qs = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : "";
        const s = await fetchJson<ServerGameState>(`/api/game/state${qs}`);
        if (!alive) return;
        applyServerState(s);
      } catch {
        // ignore transient errors
      }
    }

    tick();
    if (pollTimer.current) window.clearInterval(pollTimer.current);
    pollTimer.current = window.setInterval(tick, 1200);

    return () => {
      alive = false;
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  // Fetch wallet cards from server (allowed collections only)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!wallet.connected || !walletAddress) {
        setCardsError("");
        setCardsLoading(false);
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
            gridFromNumbersByLetter(c.numbersByLetter) ||
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

  // Keep enteredCards synced with server list (so winning checks use paid entries)
  useEffect(() => {
    if (!myEnteredIds.length) {
      setEnteredCards([]);
      return;
    }
    const byId = new Map(walletCards.map((c) => [c.id, c]));
    const paid = myEnteredIds.map((id) => byId.get(id)).filter(Boolean) as BingoCard[];
    setEnteredCards(paid);
  }, [myEnteredIds, walletCards]);

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

  const payingRef = useRef(false);
  const [paying, setPaying] = useState(false);

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
    if (!rpc) return setClaimResult({ result: "REJECTED", message: "Missing NEXT_PUBLIC_SOLANA_RPC_URL" });
    if (!pot) return setClaimResult({ result: "REJECTED", message: "Missing NEXT_PUBLIC_GAME_POT_WALLET" });

    let potPk: PublicKey;
    try {
      potPk = new PublicKey(pot);
    } catch {
      return setClaimResult({ result: "REJECTED", message: "NEXT_PUBLIC_GAME_POT_WALLET is not a valid public key." });
    }

    const count = selectedCards.length;
    const totalSol = entryFeeSol * count;
    if (!(totalSol > 0)) return setClaimResult({ result: "REJECTED", message: "Entry fee must be greater than 0." });

    const lamports = Math.round(totalSol * 1_000_000_000);

    if (payingRef.current) return;
    payingRef.current = true;
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

      await confirmSignatureByPolling(connection, sig, 60_000);

      // Persist entry on backend so pots/entries are cumulative across all wallets
      const s = await fetchJson<ServerGameState>("/api/game/enter", {
        method: "POST",
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          signature: sig,
          totalSol,
          cardIds: selectedCards.map((c) => c.id),
        }),
      });

      applyServerState(s);

      setClaimResult({
        result: "ACCEPTED",
        message: `Payment confirmed. Entered ${count} card(s) for Game #${gameNumber}. Tx: ${sig}`,
      });
    } catch (e: any) {
      setClaimResult({
        result: "REJECTED",
        message: e?.message ? `Payment/entry failed: ${e.message}` : "Payment/entry failed.",
      });
    } finally {
      setPaying(false);
      payingRef.current = false;
    }
  }

  // Admin actions (server-persisted)
  async function adminAction(payload: any) {
    try {
      const s = await fetchJson<ServerGameState>("/api/game/admin", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      applyServerState(s);
    } catch (e: any) {
      setClaimResult({ result: "REJECTED", message: e?.message ? `Admin action failed: ${e.message}` : "Admin action failed." });
    }
  }

  function adminNewGame() {
    adminAction({ action: "NEW_GAME" });
  }
  function adminLockGameStart() {
    adminAction({ action: "LOCK" });
  }
  function adminPauseToggle() {
    adminAction({ action: "PAUSE_TOGGLE" });
  }
  function adminEndGame() {
    adminAction({ action: "END" });
  }
  function adminCloseAndIncrement() {
    adminAction({ action: "CLOSE_NEXT" });
  }
  function adminCallNumber(n: number) {
    adminAction({ action: "CALL_NUMBER", number: n });
  }
  function adminUndo() {
    adminAction({ action: "UNDO_LAST" });
  }
  function adminSetType(t: GameType) {
    adminAction({ action: "SET_TYPE", gameType: t });
  }
  function adminSetFee(fee: number) {
    adminAction({ action: "SET_FEE", entryFeeSol: fee });
  }

  // Pots are server-derived (cumulative across all connected wallets)
  const entriesCount = serverEntriesCount;
  const totalPot = serverTotalPotSol;

  const playerSeriesPot = serverPlayerPotSol;
  const foundersBonus = serverFoundersBonusSol;
  const foundersSeriesPot = serverFoundersPotSol;
  const jackpotPot = serverJackpotSol;

  // Winning cards are based on paid entries (server says which mints are paid for this wallet)
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
      const s = await fetchJson<ServerGameState>("/api/game/claim", {
        method: "POST",
        body: JSON.stringify({
          wallet: walletAddress,
          cardId: claimedCard.id,
        }),
      });

      applyServerState(s);
      setClaimResult({ result: "ACCEPTED", message: `BINGO claim submitted for ${claimedCard.label}. Host is verifying now.` });
    } catch (e: any) {
      setInvalidStrikes((s) => s + 1);
      setClaimResult({ result: "REJECTED", message: e?.message ? `Claim rejected: ${e.message}` : "Claim rejected." });
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

    const perFounderBonus = foundersWinners > 0 ? foundersBonus / foundersWinners : 0;

    return { totalWinners, foundersWinners, perWinnerBase, perFounderBonus };
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
            {serverGameId ? <div className="text-xs text-slate-500 mt-1">Game ID: {serverGameId}</div> : null}
          </div>

          {isAdmin ? <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-900 text-white">ADMIN</span> : null}
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
            <p className="text-slate-700 mt-1">Entry fee is set by the admin per game. You can enter up to {maxCards} cards.</p>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-600">Entry Fee (per card)</div>
                <div className="text-xl font-extrabold text-slate-900">{formatSol(entryFeeSol)} SOL</div>
              </div>

              <div className="text-sm text-slate-600">
                Selected entries: <span className="font-semibold text-slate-900">{selectedCards.length}</span>
                <div className="text-xs text-slate-500 mt-1">
                  Paid entries: <span className="font-semibold text-slate-900">{myEnteredIds.length}</span>
                  {entriesLocked ? " (locked)" : ""}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Select your card(s)</h3>
              <p className="text-sm text-slate-600">
                Cards load from your connected wallet (Founders / Players). If your wallet is not connected, demo cards are shown.
              </p>

              {cardsLoading ? <div className="mt-4 text-sm text-slate-600">Loading your cards…</div> : null}
              {cardsError ? (
                <div className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">{cardsError}</div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {walletCards.map((card) => {
                  const selected = selectedCards.some((c) => c.id === card.id);
                  const disabled = status !== "OPEN" || entriesLocked || myEnteredIds.includes(card.id);

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

                        <div className="text-xs text-slate-600">
                          {myEnteredIds.includes(card.id) ? <span className="font-semibold text-emerald-700">Entered</span> : selected ? "Selected" : ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="text-sm text-slate-600">
                  Total buy-in:{" "}
                  <span className="font-extrabold text-slate-900">{formatSol(entryFeeSol * selectedCards.length)} SOL</span>
                  <span className="text-xs text-slate-500"> • {entriesCount} total entries • {formatSol(totalPot)} SOL total pot</span>
                </div>

                <button
                  type="button"
                  onClick={handlePayAndLockEntries}
                  disabled={status !== "OPEN" || entriesLocked || selectedCards.length === 0 || paying}
                  className={[
                    "rounded-xl px-5 py-3 font-extrabold text-white shadow",
                    "bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700",
                    status !== "OPEN" || entriesLocked || selectedCards.length === 0 || paying ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {paying ? "Processing…" : "Pay & Enter"}
                </button>
              </div>

              {lastEntrySig ? <div className="mt-3 text-xs text-slate-500">Last entry tx: {lastEntrySig}</div> : null}
              {lastEntryTotalSol ? <div className="mt-1 text-xs text-slate-500">Last entry total: {formatSol(lastEntryTotalSol)} SOL</div> : null}

              {claimResult ? (
                <div
                  className={[
                    "mt-4 text-sm rounded-xl border p-3",
                    claimResult.result === "ACCEPTED" ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900",
                  ].join(" ")}
                >
                  {claimResult.message}
                </div>
              ) : null}
            </div>

            {/* Claim section */}
            <div className="mt-10 border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-900">Call Bingo</h3>
              <p className="text-sm text-slate-600 mt-1">
                When the host calls numbers, your card auto-marks. If your entered card shows “BINGO READY,” you can claim.
              </p>

              {status === "PAUSED" && claimWindowEndsAt ? (
                <div className="mt-3 text-sm text-slate-700">
                  Claim window ends: <span className="font-semibold">{new Date(claimWindowEndsAt).toLocaleTimeString()}</span>
                </div>
              ) : null}

              <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center">
                <button
                  type="button"
                  onClick={handleCallBingo}
                  disabled={!canClaimBingo || claiming}
                  className={[
                    "rounded-xl px-5 py-3 font-extrabold text-white shadow",
                    "bg-slate-900 hover:bg-slate-800",
                    !canClaimBingo || claiming ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {claiming ? "Submitting…" : "CALL BINGO"}
                </button>

                <div className="text-sm text-slate-600">
                  Winning cards ready: <span className="font-semibold text-slate-900">{winningCards.length}</span>
                  {invalidStrikes > 0 ? <span className="ml-2 text-amber-700 font-semibold">Strikes: {invalidStrikes}</span> : null}
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            <div className="rounded-2xl shadow bg-white p-6 border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Your Card View</h3>
              <p className="text-sm text-slate-600 mt-1">Scroll through your selected/entered cards and see live marks.</p>

              <div className="mt-4">
                {activeEntries.length ? (
                  <CardCarousel cards={activeEntries} calledSet={calledSet} gameType={gameType} />
                ) : (
                  <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4">
                    Select cards to preview them here.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl shadow bg-white p-6 border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Winners</h3>
              <p className="text-sm text-slate-600 mt-1">Winners are recorded server-side when claims are accepted.</p>

              {winners.length ? (
                <div className="mt-4 space-y-2">
                  {winners.map((w) => (
                    <div key={`${w.cardId}-${w.wallet}`} className="text-sm rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="font-semibold text-slate-900">{w.isFounders ? "⭐ Founders Winner" : "🎫 Player Winner"}</div>
                      <div className="text-xs text-slate-600 mt-1">Card: {w.cardId}</div>
                      <div className="text-xs text-slate-600">Wallet: {w.wallet}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4">No winners yet.</div>
              )}

              {payoutPreview ? (
                <div className="mt-4 text-xs text-slate-600">
                  <div>Total winners: {payoutPreview.totalWinners}</div>
                  <div>Per-winner base: {formatSol(payoutPreview.perWinnerBase)} SOL</div>
                  {payoutPreview.foundersWinners ? (
                    <div>Per-founder bonus: {formatSol(payoutPreview.perFounderBonus)} SOL</div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {isAdmin ? (
              <div className="rounded-2xl shadow bg-white p-6 border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Host Controls</h3>
                <p className="text-sm text-slate-600 mt-1">These actions persist for everyone.</p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={adminNewGame}
                    className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-bold hover:bg-slate-800"
                  >
                    New Game (Open)
                  </button>
                  <button
                    type="button"
                    onClick={adminLockGameStart}
                    className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-bold hover:bg-slate-800"
                  >
                    Lock (Start)
                  </button>
                  <button
                    type="button"
                    onClick={adminPauseToggle}
                    className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-bold hover:bg-slate-800"
                  >
                    Pause/Resume
                  </button>
                  <button
                    type="button"
                    onClick={adminEndGame}
                    className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-bold hover:bg-slate-800"
                  >
                    End
                  </button>
                  <button
                    type="button"
                    onClick={adminCloseAndIncrement}
                    className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-bold hover:bg-slate-800 col-span-2"
                  >
                    Close & Next Game
                  </button>
                </div>

                <div className="mt-4">
                  <div className="text-xs text-slate-500 mb-2">Call Number</div>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => adminCallNumber(n)}
                        className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold py-2"
                      >
                        {n}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={adminUndo}
                      className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold px-3 py-2"
                    >
                      Undo last
                    </button>

                    <div className="text-xs text-slate-500">
                      Called: <span className="font-semibold text-slate-900">{calledNumbers.length}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-4">
                  <div className="text-xs text-slate-500 mb-2">Game Type</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["STANDARD", "FOUR_CORNERS", "BLACKOUT"] as GameType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => adminSetType(t)}
                        className={[
                          "rounded-lg border px-3 py-2 text-xs font-bold",
                          t === gameType ? "border-pink-500 bg-pink-50 text-pink-700" : "border-slate-200 bg-white hover:bg-slate-50 text-slate-900",
                        ].join(" ")}
                      >
                        {gameTypeLabel(t)}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 text-xs text-slate-500 mb-2">Entry Fee (SOL)</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[0.01, 0.05, 0.1].map((fee) => (
                      <button
                        key={fee}
                        type="button"
                        onClick={() => adminSetFee(fee)}
                        className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold px-3 py-2"
                      >
                        {formatSol(fee)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    Progressive: {formatSol(serverProgressiveJackpotSol)} • This game jackpot: {formatSol(serverCurrentGameJackpotSol)}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
