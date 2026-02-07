"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * MVP: /play page
 * - Local state driven (works without backend)
 * - Has clear TODOs for API wiring
 *
 * IMPORTANT:
 * - Demo cards still hardcode type (Founders/Player).
 * - Later we will replace demo inventory with wallet NFTs and detect Founders by collection.
 */

type GameType = "STANDARD" | "FOUR_CORNERS" | "BLACKOUT";
type GameStatus = "CLOSED" | "OPEN" | "LOCKED" | "PAUSED" | "ENDED";

type CardType = "PLAYER" | "FOUNDERS";

type BingoCard = {
  id: string; // mint address later; stub now
  label: string;
  type: CardType;
  grid: number[][]; // 5x5, center may be 0 for FREE
};

type ClaimResult = "ACCEPTED" | "REJECTED";

// Founders collection address (provided)
const FOUNDERS_COLLECTION = "JBg3RkePxmRYjb6b4qLQ93EatBpW8cFboc3aGW2oGDpn";

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

/** ===== Demo cards ===== */

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
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** ===== Page ===== */

export default function PlayPage() {
  // Admin UI is gated by a server-set HttpOnly cookie.
  // Admin logs in at /admin (password), which sets cookie. Then /api/admin/me returns {isAdmin:true}.
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

  // Game state (MVP local)
  const [gameNumber, setGameNumber] = useState<number>(1);
  const [status, setStatus] = useState<GameStatus>("CLOSED");
  const [gameType, setGameType] = useState<GameType>("STANDARD");
  const [entryFeeSol, setEntryFeeSol] = useState<number>(0.02);

  // Called numbers (mirror-click ledger)
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const calledSet = useMemo(() => new Set(calledNumbers), [calledNumbers]);

  // Entries
  const [selectedCards, setSelectedCards] = useState<BingoCard[]>([]);
  const [maxCards] = useState<number>(5);

  // Demo inventory (replace later with wallet NFT query)
  const [walletCards] = useState<BingoCard[]>(() => [
    demoCard("Founders Series Card (Demo)", "FOUNDERS", 41),
    demoCard("Player Series Card (Demo)", "PLAYER", 101),
    demoCard("Player Series Card #2 (Demo)", "PLAYER", 202),
  ]);

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

  // Wallet stub
  const [walletAddress] = useState<string>("(connected wallet stub)");

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
    setCalledNumbers([]);
    setSelectedCards([]);
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

    setSelectedCards((prev) => {
      const exists = prev.some((c) => c.id === card.id);
      if (exists) return prev.filter((c) => c.id !== card.id);
      if (prev.length >= maxCards) return prev;
      return [...prev, card];
    });
  }

  async function handlePayAndLockEntries() {
    if (status !== "OPEN") return;
    if (selectedCards.length === 0) {
      setClaimResult({ result: "REJECTED", message: "Select at least 1 card before entering." });
      return;
    }

    // TODO (backend):
    // 1) Prompt wallet tx: send entryFeeSol * selectedCards.length to treasury address.
    // 2) Submit signature to /api/game/enter with selected card ids.
    // 3) Backend verifies payment & locks entries.

    setClaimResult({
      result: "ACCEPTED",
      message: `Entry accepted (MVP stub). Locked ${selectedCards.length} card(s) for Game #${gameNumber}.`,
    });
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
    const isFounders = claimedCard.type === "FOUNDERS";

    // TODO (backend):
    // POST /api/game/claim with gameNumber, walletAddress, cardId, gameType

    setWinners((prev) => [...prev, { cardId: claimedCard.id, wallet: walletAddress, isFounders }]);
    setClaimResult({
      result: "ACCEPTED",
      message: `BINGO accepted for ${claimedCard.label} (${isFounders ? "Founders" : "Player"}). (MVP stub)`,
    });

    setClaiming(false);
  }

  // Payout preview (fair model)
  const payoutPreview = useMemo(() => {
    const totalWinners = winners.length;
    if (totalWinners === 0) return null;

    const foundersWinners = winners.filter((w) => w.isFounders).length;
    const perWinnerBase = totalWinners > 0 ? playerSeriesPot / totalWinners : 0;
    const perFounderBonus = foundersWinners > 0 ? foundersBonus / foundersWinners : 0;

    return {
      totalWinners,
      foundersWinners,
      perWinnerBase,
      perFounderBonus,
    };
  }, [winners, playerSeriesPot, foundersBonus]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100 px-6 py-10 md:px-10 lg:px-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900">Play NFTBingo</h1>
            <p className="text-slate-700 mt-2">
              Game #{gameNumber} • <span className="font-semibold text-slate-900">{status}</span> • Type:{" "}
              <span className="font-semibold text-slate-900">{gameTypeLabel(gameType)}</span>
            </p>
          </div>

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
                <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">{walletAddress}</span>
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
              <p className="text-sm text-slate-600 mb-4">For MVP, these are demo cards. Later this list comes from your connected wallet NFTs.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {walletCards.map((card) => {
                  const selected = selectedCards.some((c) => c.id === card.id);
                  const disabled = status !== "OPEN" || (!selected && selectedCards.length >= maxCards);
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
                            <span className={card.type === "FOUNDERS" ? "text-indigo-700 font-semibold" : "text-slate-700 font-semibold"}>
                              {card.type === "FOUNDERS" ? "Founders Series" : "Player Series"}
                            </span>
                            {/* Founders detection will switch to collection-based later (FOUNDERS_COLLECTION). */}
                          </div>
                        </div>
                        <span className={["text-xs px-2 py-1 rounded-full", selected ? "bg-pink-600 text-white" : "bg-slate-200 text-slate-700"].join(" ")}>
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
                disabled={status !== "OPEN" || selectedCards.length === 0}
                className={[
                  "cursor-pointer bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-6 py-3 rounded-xl shadow-md transition-all",
                  "hover:opacity-95 hover:shadow-lg active:scale-[0.99]",
                  status !== "OPEN" || selectedCards.length === 0 ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
              >
                Pay & Enter Game (MVP Stub)
              </button>

              <div className="text-sm text-slate-600">
                Status must be <span className="font-semibold text-slate-900">OPEN</span> to enter.
              </div>
            </div>

            {/* Called numbers + card view */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card preview */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Your card view</h3>
                <p className="text-sm text-slate-600 mb-4">Numbers auto-mark as they’re called. Free space is always marked.</p>

                {selectedCards.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-xl p-6 text-slate-600 bg-slate-50">Select card(s) above to see your grid here.</div>
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
                    <div className="text-2xl font-extrabold text-slate-900">{calledNumbers.length ? calledNumbers[calledNumbers.length - 1] : "—"}</div>
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
                      <span className="font-semibold text-slate-900">{claimWindowOpenAt ? `${claimWindowSecondsLeft}s` : "—"}</span>
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
                        "mt-4 rounded-xl p-3 text-sm border",
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
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Winners (MVP local)</h3>
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
                          <span className="text-slate-800">{w.isFounders ? "⭐ Founders" : "🎫 Player"} — {w.cardId}</span>
                          <span className="text-xs text-slate-500">{w.wallet}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {payoutPreview && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <div className="font-semibold text-slate-900 mb-2">Payout preview (fair model)</div>
                      <div className="text-slate-700">
                        Each winner base share: <span className="font-semibold text-slate-900">{formatSol(payoutPreview.perWinnerBase)} SOL</span>
                      </div>
                      <div className="text-slate-700 mt-1">
                        Founders winners: <span className="font-semibold text-slate-900">{payoutPreview.foundersWinners}</span>{" "}
                        {payoutPreview.foundersWinners > 0 ? (
                          <>
                            • Each founders bonus: <span className="font-semibold text-slate-900">{formatSol(payoutPreview.perFounderBonus)} SOL</span>
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

          {/* Right: Admin panel (ADMIN ONLY — not rendered at all for players) */}
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
                      (status !== "LOCKED" && status !== "PAUSED") || calledNumbers.length === 0 ? "opacity-50 cursor-not-allowed" : "",
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
                          picked ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50",
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
          MVP note: This page is running on local state. Next step is wiring API routes + real wallet payments + real NFT inventory.
        </div>
      </div>
    </main>
  );
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
