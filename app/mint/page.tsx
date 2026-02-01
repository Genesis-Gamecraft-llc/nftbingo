"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

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

type BuildRes =
  | { ok: true; attemptId: string; quoteId: string; txBase64: string }
  | { ok: false; error: string };

type SubmitRes =
  | {
      ok: true;
      attemptId: string;
      signature: string;
      status: string;
      explorer: string;

      // reveal payload
      name: string;
      serial: string;
      backgroundId: number;
      imageUri: string;
      metadataUri: string;
      mint?: string | null;
    }
  | { ok: false; error: string };

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

function shortPk(pk: string) {
  return pk.length > 10 ? `${pk.slice(0, 4)}…${pk.slice(-4)}` : pk;
}

export default function MintPage() {
  const wallet = useWallet();
  const pubkey = useMemo(() => wallet.publicKey?.toBase58() || "", [wallet.publicKey]);

  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<QuoteRes | null>(null);
  const [build, setBuild] = useState<BuildRes | null>(null);
  const [submit, setSubmit] = useState<SubmitRes | null>(null);
  const [err, setErr] = useState("");
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

  async function doQuote() {
    if (!pubkey) return;

    setErr("");
    setQuote(null);
    setBuild(null);
    setSubmit(null);
    setSecondsLeft(0);

    try {
      setBusy(true);
      const url = `/api/mint/quote?wallet=${encodeURIComponent(pubkey)}&tier=platinum`;
      const r = await fetch(url, { method: "GET", cache: "no-store" });
      const j = (await r.json()) as QuoteRes;

      setQuote(j);
      if (j.ok) startTimer(j.expiresAt);
      else setErr(j.error || "Quote failed");
    } catch (e: any) {
      setErr(e?.message ?? "Quote failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (wallet.connected && pubkey) {
      doQuote();
    } else {
      setQuote(null);
      setBuild(null);
      setSubmit(null);
      setErr("");
      setSecondsLeft(0);
      clearTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.connected, pubkey]);

  async function doMint() {
    setErr("");
    setBuild(null);
    setSubmit(null);

    if (!wallet.connected || !pubkey) {
      setErr("Connect your wallet using the Connect button in the navbar.");
      return;
    }
    if (!quote || !quote.ok) {
      setErr("No valid quote. Click Refresh Quote.");
      return;
    }
    if (secondsLeft <= 0) {
      setErr("Quote expired. Click Refresh Quote.");
      return;
    }
    if (!wallet.signTransaction) {
      setErr("Your wallet does not support signTransaction.");
      return;
    }

    try {
      setBusy(true);

      const buildRes = await fetch("/api/mint/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: pubkey, quoteId: quote.quoteId }),
      });

      const b = (await buildRes.json()) as BuildRes;
      setBuild(b);
      if (!b.ok) {
        setErr(b.error || "Build failed");
        return;
      }

      const raw = base64ToBytes(b.txBase64);

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
        body: JSON.stringify({ attemptId: b.attemptId, signedTxBase64 }),
      });

      const s = (await submitRes.json()) as SubmitRes;
      setSubmit(s);

      if (!s.ok) {
        setErr(s.error || "Submit failed");
        return;
      }
    } catch (e: any) {
      setErr(e?.message ?? "Mint failed");
    } finally {
      setBusy(false);
    }
  }

  const priceLabel = useMemo(() => {
    if (!quote || !quote.ok) return "";
    return quote.priceSol ? `${quote.priceSol} SOL` : `${quote.priceLamports} lamports`;
  }, [quote]);

  const connectedLabel = wallet.connected && pubkey ? `Connected: ${shortPk(pubkey)}` : "Not connected";

  const mintDisabled = busy || !wallet.connected || !quote || (quote.ok && secondsLeft <= 0);

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-white to-slate-100 overflow-hidden">
      <section className="relative overflow-hidden bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white py-20 px-6 text-center">
        <h1 className="relative text-5xl md:text-6xl font-extrabold mb-4 z-10">Founders Series Mint</h1>
        <p className="relative max-w-2xl mx-auto text-lg opacity-90 z-10">
          Connect in the navbar, then mint your card below. Reveal happens after approval. Please be patient while it works, as the build can sometimes take a up to a minute.
        </p>
      </section>

      <section className="max-w-5xl mx-auto py-14 px-6">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold">Mint</h2>
              <span className="text-sm text-slate-600">{connectedLabel}</span>
            </div>

            <div className="mt-4 space-y-3 text-slate-700">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                <ol className="list-decimal pl-5 space-y-2 text-sm">
                  <li>Connect your wallet using the button in the navbar.</li>
                  <li>Confirm the quote (auto-loads when you connect).</li>
                  <li>Click Mint and approve the transaction in your wallet.</li>
                  <li>Your card is revealed after approval.</li>
                </ol>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="rounded-xl bg-white text-pink-600 font-semibold px-6 py-3 shadow hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={doQuote}
                  disabled={!wallet.connected || busy}
                >
                  Refresh Quote
                </button>

                <button
                  className="rounded-xl bg-white text-pink-600 font-semibold px-8 py-3 shadow hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={doMint}
                  disabled={mintDisabled}
                >
                  {busy ? "Working…" : "Mint"}
                </button>
              </div>

              {quote?.ok ? (
                <div className="mt-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">Price:</span> {priceLabel}
                  {" · "}
                  <span className="font-semibold text-slate-900">Quote expires in:</span> {secondsLeft}s
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-600">
                  {!wallet.connected ? <>Connect your wallet in the navbar to load your mint quote.</> : <>Click Refresh Quote to load pricing.</>}
                </div>
              )}

              {err ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold">Your Card</h2>
            <p className="mt-2 text-sm text-slate-600">Revealed only after you approve the mint.</p>

            {!submit?.ok ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                Card reveal appears here after approval.
              </div>
            ) : (
              <>
                <div className="mt-4 text-sm text-slate-600 space-y-2">
                  <div>
                    <span className="font-semibold text-slate-900">Card:</span> {submit.name}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Serial:</span> {submit.serial}
                    {" · "}
                    <span className="font-semibold text-slate-900">Background:</span> {submit.backgroundId}
                  </div>
                  <div className="break-all">
                    <span className="font-semibold text-slate-900">Metadata:</span>{" "}
                    <a className="underline" href={submit.metadataUri} target="_blank" rel="noreferrer">
                      {submit.metadataUri}
                    </a>
                  </div>
                  <div className="break-all">
                    <span className="font-semibold text-slate-900">Tx:</span>{" "}
                    <a className="underline" href={submit.explorer} target="_blank" rel="noreferrer">
                      View on Explorer
                    </a>
                  </div>
                </div>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={submit.imageUri} alt="Your minted card" className="mt-5 w-full rounded-xl border border-slate-200" />
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-slate-500 text-sm">
        © {new Date().getFullYear()} NFTBingo • Built on Solana • nftbingo.net
      </footer>
    </main>
  );
}
