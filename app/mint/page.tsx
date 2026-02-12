"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, VersionedTransaction } from "@solana/web3.js";


/** ---------- Shared helpers ---------- */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}


async function signSerialize(wallet: any, raw: Uint8Array): Promise<Uint8Array> {
  if (!wallet.signTransaction) {
    throw new Error("Your wallet does not support signTransaction.");
  }

  // Support both v0 (versioned) and legacy transactions
  try {
    const vtx = VersionedTransaction.deserialize(raw);
    const signed = await wallet.signTransaction(vtx as any);
    return signed.serialize();
  } catch {
    const tx = Transaction.from(raw);
    const signed = await wallet.signTransaction(tx as any);
    return signed.serialize();
  }
}
function shortPk(pk: string) {
  return pk.length > 10 ? `${pk.slice(0, 4)}…${pk.slice(-4)}` : pk;
}

type MintMode = "FOUNDERS" | "PLAYER";

/** ---------- Founders types (existing) ---------- */
type QuoteRes =
  | {
      ok: true;
      quoteId: string;
      tier: string;
      priceLamports: string;
      priceSol?: string;
      issuedAt: number;
      expiresAt: number;
      validForSeconds: number;
    }
  | { ok: false; error: string };

type FoundersBuildRes =
  | { ok: true; attemptId: string; quoteId: string; txBase64: string }
  | { ok: false; error: string };

type FoundersSubmitRes =
  | {
      ok: true;
      attemptId: string;
      signature: string;
      status: string;
      explorer: string;
      name: string;
      serial: string;
      backgroundId: number;
      imageUri: string;
      metadataUri: string;
      mint?: string | null;
    }
  | { ok: false; error: string };

/** ---------- Player types ---------- */
type PlayerInitRes =
  | {
      ok: true;
      buildId: string;
      count: number;
      packages: Array<{
        index: number;
        serialNum?: number;
        serialStr: string;
        backgroundId?: number;
      }>;
    }
  | { ok: false; error: string };

type PlayerBuildRes =
  | {
      ok: true;
      attemptId: string;
      txs?: Array<{ index: number; serialStr: string; mint: string; txBase64: string }>;
      txBase64?: string;
      mints?: Array<{ index: number; serialStr: string; mint: string; imageUri: string; metadataUri: string }>;
    }
  | { ok: false; error: string };

type PlayerSubmitRes =
  | { ok: true; signature?: string; results?: Array<{ i: number; ok: boolean; signature?: string; error?: string }> }
  | { ok: false; error: string };

export default function MintPage() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const pubkey = useMemo(() => wallet.publicKey?.toBase58() || "", [wallet.publicKey]);

  const [mode, setMode] = useState<MintMode>("FOUNDERS");

  /** ---------- Founders state ---------- */
  const [busyFounders, setBusyFounders] = useState(false);
  const [quote, setQuote] = useState<QuoteRes | null>(null);
  const [foundersSubmit, setFoundersSubmit] = useState<FoundersSubmitRes | null>(null);
  const [foundersErr, setFoundersErr] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<number | null>(null);

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }
  function startTimer(expiresAt: number) {
    clearTimer();
    const tick = () => {
      const s = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(s);
      if (s <= 0) clearTimer();
    };
    tick();
    timerRef.current = window.setInterval(tick, 250);
  }
  useEffect(() => () => clearTimer(), []);

  async function doFoundersQuote() {
    if (!pubkey) return;

    setFoundersErr("");
    setQuote(null);
    setFoundersSubmit(null);
    setSecondsLeft(0);

    try {
      setBusyFounders(true);
      const url = `/api/mint/quote?wallet=${encodeURIComponent(pubkey)}&tier=platinum`;
      const r = await fetch(url, { method: "GET", cache: "no-store" });
      const j = (await r.json()) as QuoteRes;
      setQuote(j);
      if (j.ok) startTimer(j.expiresAt);
      else setFoundersErr(j.error || "Quote failed");
    } catch (e: any) {
      setFoundersErr(e?.message ?? "Quote failed");
    } finally {
      setBusyFounders(false);
    }
  }

  useEffect(() => {
    if (wallet.connected && pubkey) {
      if (mode === "FOUNDERS") void doFoundersQuote();
    } else {
      setQuote(null);
      setFoundersSubmit(null);
      setFoundersErr("");
      setSecondsLeft(0);
      clearTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.connected, pubkey]);

  useEffect(() => {
    if (mode === "FOUNDERS" && wallet.connected && pubkey) {
      if (!quote || !quote.ok || secondsLeft <= 0) void doFoundersQuote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function doFoundersMint() {
    setFoundersErr("");
    setFoundersSubmit(null);

    if (!wallet.connected || !pubkey) return setFoundersErr("Connect your wallet using the Connect button in the navbar.");
    if (!quote || !quote.ok) return setFoundersErr("No valid quote. Click Refresh Quote.");
    if (secondsLeft <= 0) return setFoundersErr("Quote expired. Click Refresh Quote.");
    if (!wallet.signTransaction) return setFoundersErr("Your wallet does not support signTransaction.");

    try {
      setBusyFounders(true);

      const buildRes = await fetch("/api/mint/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: pubkey, quoteId: quote.quoteId }),
      });
      const build = (await buildRes.json()) as FoundersBuildRes;
      if (!build.ok) return setFoundersErr(build.error || "Build failed");

      const raw = base64ToBytes(build.txBase64);

      let signedBytes: Uint8Array;
      try {
        const vtx = VersionedTransaction.deserialize(raw);
        const signed = await wallet.signTransaction(vtx as any);
        signedBytes = signed.serialize();
      } catch {
        const tx = Transaction.from(raw);
        const signed = await wallet.signTransaction(tx as any);
        signedBytes = signed.serialize();
      }

      const signedTxBase64 = bytesToBase64(signedBytes);

      const submitRes = await fetch("/api/mint/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId: build.attemptId, signedTxBase64 }),
      });
      const submit = (await submitRes.json()) as FoundersSubmitRes;
      setFoundersSubmit(submit);
      if (!submit.ok) return setFoundersErr(submit.error || "Submit failed");
    } catch (e: any) {
      setFoundersErr(e?.message ?? "Mint failed");
    } finally {
      setBusyFounders(false);
    }
  }

  const foundersPriceLabel = useMemo(() => {
    if (!quote || !quote.ok) return "";
    return quote.priceSol ? `${quote.priceSol} SOL` : `${quote.priceLamports} lamports`;
  }, [quote]);

  const foundersMintDisabled =
    busyFounders || !wallet.connected || !quote || (quote.ok && secondsLeft <= 0);

  /** ---------- Player state (locked to 1) ---------- */
  const [busyPlayer, setBusyPlayer] = useState(false);
  const [playerErr, setPlayerErr] = useState("");
  const [playerLastMint, setPlayerLastMint] = useState<{ imageUri?: string; metadataUri?: string; signature?: string } | null>(null);



async function doPlayerMintOne() {
  setPlayerErr("");
  setPlayerLastMint(null);

  if (!wallet.connected || !pubkey) return setPlayerErr("Connect your wallet using the Connect button in the navbar.");
  if (!wallet.signTransaction) return setPlayerErr("Your wallet does not support signTransaction.");

  try {
    setBusyPlayer(true);

    // INIT
    const initRes = await fetch("/api/player-mint/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: pubkey, count: 1 }),
    });

    if (!initRes.ok) {
      const t = await initRes.text();
      throw new Error(`init failed (${initRes.status}): ${t.slice(0, 300)}`);
    }

    const init = (await initRes.json()) as PlayerInitRes;
    if (!init.ok) throw new Error(init.error || "init failed");
    if (!init.packages?.length) throw new Error("init returned no packages");

    const pkg = init.packages[0];

    // BUILD (server generates PNG + metadata and pays Irys)
    const buildRes = await fetch("/api/player-mint/build", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        buildId: init.buildId,
        wallet: pubkey,
        items: [{ index: pkg.index }],
      }),
    });

    if (!buildRes.ok) {
      const t = await buildRes.text();
      throw new Error(`build failed (${buildRes.status}): ${t.slice(0, 300)}`);
    }

    const build = (await buildRes.json()) as PlayerBuildRes;
    if (!build.ok) throw new Error(build.error || "build failed");

    const txBase64 = build.txs?.[0]?.txBase64 || build.txBase64;
    if (!txBase64 || typeof txBase64 !== "string") throw new Error("build did not return txBase64");

    // SIGN (ONE prompt)
    const raw = base64ToBytes(txBase64);
    const signedBytes = await signSerialize(wallet, raw);
    const signedTxBase64 = bytesToBase64(signedBytes);

    // SUBMIT
    const submitRes = await fetch("/api/player-mint/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attemptId: build.attemptId,
        signedTxBase64s: [signedTxBase64],
      }),
    });

    if (!submitRes.ok) {
      const t = await submitRes.text();
      throw new Error(`submit failed (${submitRes.status}): ${t.slice(0, 300)}`);
    }

    const submit = (await submitRes.json()) as PlayerSubmitRes;
    if (!submit.ok) throw new Error(submit.error || "submit failed");

    const sig = submit.signature || submit.results?.find((r) => r.ok)?.signature || "";
    const minted = (build as any).mints?.[0];

    setPlayerLastMint({
      imageUri: minted?.imageUri,
      metadataUri: minted?.metadataUri,
      signature: sig,
    });
  } catch (e: any) {
    setPlayerErr(e?.message ?? "Player mint failed");
  } finally {
    setBusyPlayer(false);
  }
}

  const connectedLabel = wallet.connected && pubkey ? `Connected: ${shortPk(pubkey)}` : "Not connected";

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-white to-slate-100 overflow-hidden">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white py-20 px-6 text-center">
        <h1 className="relative text-5xl md:text-6xl font-extrabold mb-4 z-10">Mint Your NFTBingo Card</h1>
        <p className="relative max-w-2xl mx-auto text-lg opacity-90 z-10">
          Choose Founders Series to play NFTBingo with premium access, airdrops, payouts, and rental rewards. Mint a free Player Series card to jump into games and play with standard benefits.
        </p>
      </section>

      <section className="max-w-5xl mx-auto py-12 px-6">
        {/* ✅ BIG DECISION TOGGLE (CENTERED) */}
        <div className="flex flex-col items-center gap-3 mb-10">
          <div className="text-sm text-slate-600">Wallet: <span className="font-semibold">{connectedLabel}</span></div>

          <div className="inline-flex rounded-2xl p-2 bg-white border border-slate-200 shadow-sm">
            <button
              onClick={() => setMode("FOUNDERS")}
              className={[
                "px-8 py-4 rounded-xl font-extrabold text-lg md:text-xl transition",
                "min-w-[240px] md:min-w-[280px]",
                mode === "FOUNDERS"
                  ? "bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white shadow"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              ].join(" ")}
            >
              Mint Founders Series ($125)
            </button>

            <button
              onClick={() => setMode("PLAYER")}
              className={[
                "px-8 py-4 rounded-xl font-extrabold text-lg md:text-xl transition ml-2",
                "min-w-[240px] md:min-w-[280px]",
                mode === "PLAYER"
                  ? "bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white shadow"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              ].join(" ")}
            >
              Mint Players Series (FREE)
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Mints are limited to <span className="font-semibold">1 per transaction</span> for reliability due to card size.
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* LEFT: Mint panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {mode === "FOUNDERS" ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-bold">Founders Series Mint</h2>
                  {quote?.ok ? (
                    <span className="text-sm text-slate-600">Quote: {secondsLeft}s</span>
                  ) : (
                    <span className="text-sm text-slate-500">Quote required</span>
                  )}
                </div>

                <div className="mt-4 space-y-3 text-slate-700">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <ol className="list-decimal pl-5 space-y-2 text-sm">
                      <li>Connect your wallet using the button in the navbar.</li>
                      <li>Confirm the quote (auto-loads when you connect).</li>
                      <li>Click Mint and approve the transaction.</li>
                      <li>Your card is revealed after approval.</li>
                    </ol>
                  </div>

                  {/* ✅ BIG GRADIENT ACTION BUTTONS */}
                  <div className="mt-4 flex flex-col sm:flex-row sm:justify-center gap-3">
                    <button
                      className="rounded-xl bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-bold px-8 py-4 text-base shadow hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={doFoundersQuote}
                      disabled={!wallet.connected || busyFounders}
                    >
                      Refresh Quote
                    </button>

                    <button
                      className="rounded-xl bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-bold px-10 py-4 text-base shadow hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={doFoundersMint}
                      disabled={foundersMintDisabled}
                    >
                      {busyFounders ? "Working…" : "Mint Founders Card"}
                    </button>
                  </div>

                  {quote?.ok ? (
                    <div className="mt-3 text-sm text-slate-600 text-center">
                      <span className="font-semibold text-slate-900">Price:</span> {foundersPriceLabel}
                      {" · "}
                      <span className="font-semibold text-slate-900">Expires:</span> {secondsLeft}s
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-slate-600 text-center">
                      {!wallet.connected ? (
                        <>Connect your wallet in the navbar to load your mint quote.</>
                      ) : (
                        <>Click Refresh Quote to load pricing.</>
                      )}
                    </div>
                  )}

                  {foundersErr ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      {foundersErr}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-bold">Player Series Mint</h2>
                  <span className="text-sm text-slate-600">Free • 1 per mint</span>
                </div>

                <div className="mt-4 space-y-3 text-slate-700">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <ul className="list-disc pl-5 space-y-2 text-sm">
                      <li>Player Series cards are free to mint (you only pay network + storage fees, usually ~$2 depending on Solana network conditions).</li>
                      <li>These cards can be used in any game that supports Player Series cards on NFTBingo.net</li>
                      <li>These cards are not be eligible for Founders Series rewards or special benefits. They will not be eligible for delegating or renting in our marketplace.</li>
                      <li>Your wallet will likely ask you to verify 4 times. There are 2 for Irys upload and fee and 2 for wallet transfer and fee. This is where the ~$2 comes from. </li>
                    </ul>
                  </div>

                  {/* ✅ BIG GRADIENT ACTION BUTTON */}
                  <div className="flex justify-center">
                    <button
                      className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-bold px-10 py-4 text-base shadow hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={doPlayerMintOne}
                      disabled={!wallet.connected || busyPlayer}
                    >
                      {busyPlayer ? "Working…" : "Mint Free Player Card"}
                    </button>
                  </div>

                  {playerErr ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      {playerErr}
                    </div>
                  ) : null}

                  {playerLastMint?.metadataUri ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                      <div className="font-semibold text-emerald-800">Mint successful</div>
                      <div className="mt-2 space-y-1 text-emerald-900/80 break-all">
                        {playerLastMint.signature ? (
                          <div>
                            <span className="font-semibold">Tx:</span> {playerLastMint.signature}
                          </div>
                        ) : null}
                        <div>
                          <span className="font-semibold">Metadata:</span>{" "}
                          <a className="underline" href={playerLastMint.metadataUri} target="_blank" rel="noreferrer">
                            {playerLastMint.metadataUri}
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>

          {/* RIGHT: Preview panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold">What you’re minting</h2>

            {mode === "FOUNDERS" ? (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Founders Series cards are premium NFTs with utility and payout bonuses during games.
                </p>

                <div className="mt-5 rounded-xl bg-gradient-to-r from-pink-50 via-fuchsia-50 to-indigo-50 border border-slate-200 p-4">
                  <div className="text-sm text-slate-700 space-y-2">
                    <div><span className="font-semibold">Tier:</span> Platinum (current mint)</div>
                    <div><span className="font-semibold">Reveal:</span> After transaction approval</div>
                    <div><span className="font-semibold">Quote:</span> Auto-refreshes when connected</div>
                  </div>
                </div>

                {!foundersSubmit?.ok ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                    Mint a Founders card to see the reveal preview here.
                  </div>
                ) : (
                  <>
                    <div className="mt-4 text-sm text-slate-600 space-y-2">
                      <div><span className="font-semibold text-slate-900">Card:</span> {foundersSubmit.name}</div>
                      <div>
                        <span className="font-semibold text-slate-900">Serial:</span> {foundersSubmit.serial}
                        {" · "}
                        <span className="font-semibold text-slate-900">Background:</span> {foundersSubmit.backgroundId}
                      </div>
                      <div className="break-all">
                        <span className="font-semibold text-slate-900">Metadata:</span>{" "}
                        <a className="underline" href={foundersSubmit.metadataUri} target="_blank" rel="noreferrer">
                          {foundersSubmit.metadataUri}
                        </a>
                      </div>
                      <div className="break-all">
                        <span className="font-semibold text-slate-900">Tx:</span>{" "}
                        <a className="underline" href={foundersSubmit.explorer} target="_blank" rel="noreferrer">
                          View on Explorer
                        </a>
                      </div>
                    </div>

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={foundersSubmit.imageUri}
                      alt="Your minted card"
                      className="mt-5 w-full rounded-xl border border-slate-200"
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Player Series cards are free mints used to join and play games on NFTBingo.net. They are intended to be an entry level card with standard payouts and no special benefits, but they can still be used in any game that supports Player Series cards.
                </p>

                <div className="mt-5 rounded-xl bg-gradient-to-r from-pink-50 via-fuchsia-50 to-indigo-50 border border-slate-200 p-4">
                  <div className="text-sm text-slate-700 space-y-2">
                    <div><span className="font-semibold">Cost:</span> FREE + network + storage fees</div>
                    <div><span className="font-semibold">Limit:</span> 1 per mint</div>
                    <div><span className="font-semibold">Use:</span> enter games on NFTBingo.net</div>
                  </div>
                </div>

                {playerLastMint?.imageUri ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={playerLastMint.imageUri}
                      alt="Latest Player mint"
                      className="mt-6 w-full rounded-xl border border-slate-200"
                    />
                  </>
                ) : (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                    Mint a Player card to preview it here.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-10 text-xs text-slate-500 text-center">
          Founders Series cards are USD pegged to $125 at mint time. Storage fees are payed by us, mint fees are payed by you. Player Series cards are free to mint, but you pay the network and storage fees (usually a few dollars). Prices may fluctuate based on Solana network conditions.
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-slate-500 text-sm">
        © {new Date().getFullYear()} NFTBingo • Built on Solana • NFTBingo.net
      </footer>
    </main>
  );
}