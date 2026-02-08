"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

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

/** Convert numbersByLetter → 5x5 grid */
function gridFromNumbersByLetter(nbl: any): number[][] | null {
  try {
    const B: number[] = nbl?.B ?? [];
    const I: number[] = nbl?.I ?? [];
    const N: number[] = nbl?.N ?? [];
    const G: number[] = nbl?.G ?? [];
    const O: number[] = nbl?.O ?? [];
    if (B.length < 5 || I.length < 5 || N.length < 4 || G.length < 5 || O.length < 5) return null;

    const grid: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));

    for (let r = 0; r < 5; r++) grid[r][0] = Number(B[r]);
    for (let r = 0; r < 5; r++) grid[r][1] = Number(I[r]);

    // N is 4 values (no center). Fill rows 0,1 then rows 3,4. Center = FREE.
    grid[0][2] = Number(N[0]);
    grid[1][2] = Number(N[1]);
    grid[2][2] = 0; // FREE
    grid[3][2] = Number(N[2]);
    grid[4][2] = Number(N[3]);

    for (let r = 0; r < 5; r++) grid[r][3] = Number(G[r]);
    for (let r = 0; r < 5; r++) grid[r][4] = Number(O[r]);

    return grid;
  } catch {
    return null;
  }
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
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** ===== Page ===== */

export default function PlayPage() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || "";

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

  // Wallet inventory
  const [walletCards, setWalletCards] = useState<BingoCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string>("");

  // Load cards when wallet connects
  useEffect(() => {
    let alive = true;

    async function load() {
      setCardsError("");
      setCardsLoading(true);
      try {
        if (!walletAddress) {
          setWalletCards([]);
          return;
        }
        const r = await fetch(`/api/cards/owned?owner=${encodeURIComponent(walletAddress)}&t=${Date.now()}`, {
          cache: "no-store",
        });
        const j = await r.json();
        if (!alive) return;

        if (!r.ok || !j?.ok) {
          setWalletCards([]);
          setCardsError(j?.error || "Failed to load cards");
          return;
        }

        const cards: BingoCard[] = (j.cards || [])
          .map((c: any) => {
            const grid = gridFromNumbersByLetter(c.numbersByLetter);
            if (!grid) return null;

            const type: CardType = c.series === "FOUNDERS" ? "FOUNDERS" : "PLAYER";
            const label =
              type === "FOUNDERS"
                ? (c.name || "Founders Card")
                : (c.name || "Player Card");

            return {
              id: c.mint,
              label,
              type,
              grid,
            } as BingoCard;
          })
          .filter(Boolean);

        setWalletCards(cards);
      } catch (e: any) {
        if (!alive) return;
        setWalletCards([]);
        setCardsError(e?.message || "Failed to load cards");
      } finally {
        if (!alive) return;
        setCardsLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [walletAddress]);

  const effectiveInventory: BingoCard[] = useMemo(() => {
    if (walletCards.length) return walletCards;
    // Demo only if wallet not connected
    if (!walletAddress) {
      return [
        demoCard("Founders Series Card (Demo)", "FOUNDERS", 41),
        demoCard("Player Series Card (Demo)", "PLAYER", 101),
        demoCard("Player Series Card #2 (Demo)", "PLAYER", 202),
      ];
    }
    return [];
  }, [walletCards, walletAddress]);

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
    if (n < 1 || n > 75) return;
    setCalledNumbers((prev) => uniquePush(prev, n));
    // If claim window is open, calling a number closes it (matches your rule)
    if (claimWindowOpenAt) {
      closeClaimWindow();
    }
  }

  function adminUndo() {
    if (status !== "LOCKED" && status !== "PAUSED") return;
    setCalledNumbers((prev) => removeLast(prev));
  }

  // Player actions
  function toggleSelect(card: BingoCard) {
    if (status !== "OPEN") return;

    setSelectedCards((prev) => {
      const exists = prev.some((c) => c.id === card.id);
      if (exists) return prev.filter((c) => c.id !== card.id);
      if (prev.length >= maxCards) return prev;
      return [...prev, card];
    });
  }

  async function payAndEnterMvpStub() {
    // Tomorrow MVP: you’re doing payouts manually.
    // This button is just your “I entered” marker. Payment wiring is next.
    if (status !== "OPEN") return;
    if (!walletAddress) return;

    // For MVP we keep it simple: selection itself is the entry list.
    // You can wire real payments next.
    setClaimResult(null);
  }

  async function claimBingo() {
    if (!canClaimBingo) return;

    setClaiming(true);
    try {
      // MVP local verify: if any selected card is actually a win, accept.
      const isWin = winningCards.length > 0;
      const now = Date.now();
      setLastClaimAt(now);

      if (!isWin) {
        setInvalidStrikes((s) => s + 1);
        setClaimResult({ result: "REJECTED", message: "Not a valid bingo for your selected card(s)." });
        return;
      }

      // One win per card per game (MVP local: record winners list)
      const newWinners = winningCards.map((c) => ({
        cardId: c.label,
        wallet: walletAddress || "(unknown)",
        isFounders: c.type === "FOUNDERS",
      }));

      setWinners((prev) => {
        const existing = new Set(prev.map((x) => `${x.wallet}:${x.cardId}`));
        const add = newWinners.filter((x) => !existing.has(`${x.wallet}:${x.cardId}`));
        return [...prev, ...add];
      });

      setClaimResult({ result: "ACCEPTED", message: "Bingo accepted (MVP). Added to winners list." });
    } finally {
      setClaiming(false);
    }
  }

  /** ===== Render ===== */

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900">NFTBingo — Play</h1>
            <div className="text-slate-600 mt-1">
              Game #{gameNumber} • <span className="font-semibold text-slate-900">{gameTypeLabel(gameType)}</span> • Status:{" "}
              <span className="font-semibold text-slate-900">{status}</span>
            </div>
          </div>

          {isAdmin ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-900">
              ADMIN
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <PotCard title="Player Series Pot" value={`${formatSol(playerSeriesPot)} SOL`} />
          <PotCard title="Founders Series Pot" value={`${formatSol(foundersSeriesPot)} SOL`} />
          <PotCard title="Progressive Jackpot" value={`${formatSol(jackpotPot)} SOL`} />
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left: Join & Play */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-6 md:p-8">
            <h2 className="text-2xl font-bold text-slate-900">Join & Play</h2>
            <p className="text-slate-700 mt-1">
              Entry fee is set by the admin per game. You can enter up to {maxCards} cards.
            </p>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Wallet:{" "}
                <span className="font-mono text-xs text-slate-900">
                  {walletAddress || "(connect wallet in navbar)"}
                </span>
              </div>

              <div className="text-sm text-slate-600">
                Selected entries:{" "}
                <span className="font-semibold text-slate-900">{selectedCards.length}</span>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-600">Entry Fee (per card)</div>
                <div className="text-xl font-extrabold text-slate-900">{formatSol(entryFeeSol)} SOL</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="font-semibold text-slate-900">Select your card(s)</div>
              <p className="text-sm text-slate-600 mt-1">
                Cards load from your connected wallet (Founders / Players). If your wallet is not connected, demo cards are shown.
              </p>

              {cardsLoading ? (
                <div className="mt-3 text-sm text-slate-600">Loading your cards…</div>
              ) : null}

              {cardsError ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {cardsError}
                </div>
              ) : null}

              {walletAddress && !cardsLoading && effectiveInventory.length === 0 ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  No eligible NFTBingo cards found in this wallet.
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {effectiveInventory.map((c) => {
                  const selected = selectedCards.some((x) => x.id === c.id);
                  const disabled = status !== "OPEN";
                  return (
                    <div
                      key={c.id}
                      className={[
                        "rounded-xl border p-4 bg-white flex items-center justify-between",
                        selected ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200",
                        disabled ? "opacity-60" : "",
                      ].join(" ")}
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{c.label}</div>
                        <div className="text-xs text-slate-600 mt-1">
                          Type: {c.type === "FOUNDERS" ? "Founders Series" : "Player Series"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleSelect(c)}
                        disabled={disabled}
                        className={[
                          "rounded-lg px-3 py-1 text-sm font-semibold border",
                          selected
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50",
                          disabled ? "cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        {selected ? "Selected" : "Select"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={payAndEnterMvpStub}
                  disabled={status !== "OPEN" || selectedCards.length === 0 || !walletAddress}
                  className={[
                    "cursor-pointer bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-6 py-3 rounded-xl shadow-md transition-all hover:opacity-95",
                    status !== "OPEN" || selectedCards.length === 0 || !walletAddress ? "opacity-50 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  Pay & Enter Game (MVP Stub)
                </button>

                <div className="text-xs text-slate-500 mt-2">
                  Status must be <span className="font-semibold text-slate-900">OPEN</span> to enter.
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="font-semibold text-slate-900 mb-2">Your card view</div>
                <p className="text-sm text-slate-600 mb-3">
                  Numbers auto-mark as they’re called. Free space is always marked.
                </p>

                {selectedCards.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                    Select card(s) above to see your grid here.
                  </div>
                ) : (
                  <CardCarousel cards={selectedCards} calledSet={calledSet} gameType={gameType} />
                )}
              </div>

              <div>
                <div className="font-semibold text-slate-900 mb-2">Called numbers</div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs text-slate-600">Last called</div>
                  <div className="mt-2 text-2xl font-extrabold text-slate-900">
                    {calledNumbers.length ? calledNumbers[calledNumbers.length - 1] : "—"}
                  </div>

                  <div className="mt-4 text-xs text-slate-600">History</div>
                  <div className="mt-2 text-sm text-slate-700">
                    {calledNumbers.length ? calledNumbers.join(", ") : "No numbers called yet."}
                  </div>

                  <div className="mt-4 text-xs text-slate-600">Claim window</div>
                  <div className="mt-1 text-sm text-slate-700">
                    Closes on next called number or 60s.
                    {claimWindowOpenAt ? (
                      <>
                        {" "}
                        • <span className="font-semibold text-slate-900">{claimWindowSecondsLeft}s</span> left
                      </>
                    ) : (
                      <> • Not open</>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={claimBingo}
                    disabled={!canClaimBingo || claiming}
                    className={[
                      "w-full rounded-xl px-6 py-3 font-extrabold text-white shadow-md transition-all",
                      canClaimBingo ? "bg-slate-900 hover:opacity-95" : "bg-slate-300 cursor-not-allowed",
                    ].join(" ")}
                  >
                    {claiming ? "Checking…" : "CALL BINGO"}
                  </button>

                  {claimResult ? (
                    <div
                      className={[
                        "mt-3 rounded-lg px-3 py-2 text-sm",
                        claimResult.result === "ACCEPTED"
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "border border-rose-200 bg-rose-50 text-rose-900",
                      ].join(" ")}
                    >
                      {claimResult.message}
                    </div>
                  ) : null}

                  {invalidStrikes > 0 ? (
                    <div className="mt-2 text-xs text-slate-500">
                      Invalid claims: <span className="font-semibold text-slate-900">{invalidStrikes}</span> (3 = locked out)
                    </div>
                  ) : null}
                </div>
              </div>
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

              <div className="mt-6">
                <div className="text-xs text-slate-500">Winners (local MVP)</div>
                <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4">
                  {winners.length === 0 ? (
                    <div className="text-sm text-slate-600">No winners yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {winners.map((w, idx) => (
                        <div key={`${w.cardId}-${idx}`} className="flex items-center justify-between text-sm">
                          <span className="text-slate-800">
                            {w.isFounders ? "⭐ Founders" : "🎫 Player"} — {w.cardId}
                          </span>
                          <span className="text-xs text-slate-500">{w.wallet}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-500">Tomorrow MVP: payouts are manual. This list helps you audit.</div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-10 text-xs text-slate-500">
          MVP note: VIP/Core is disabled for tomorrow. Founders + Players only.
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
        {grid.map((row, r) =>
          row.map((v, c) => {
            const isFree = r === 2 && c === 2;
            const marked = isFree || v === 0 || calledSet.has(v);
            return (
              <div
                key={`${r}-${c}`}
                className={[
                  "h-12 flex items-center justify-center text-sm font-bold border-t border-slate-200 border-r last:border-r-0",
                  marked ? "bg-emerald-50 text-emerald-900" : "bg-white text-slate-900",
                  isFree ? "bg-indigo-50 text-indigo-900" : "",
                ].join(" ")}
              >
                {isFree ? "FREE" : v}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
