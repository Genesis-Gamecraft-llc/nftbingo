"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { WalletName } from "@solana/wallet-adapter-base";
import { VersionedTransaction, Transaction } from "@solana/web3.js";

type QuoteRes =
  | { ok: true; quoteId: string; priceLamports: string; expiresAt: number; priceSol?: string }
  | { ok: false; error: string };

type BuildRes =
  | {
      ok: true;
      attemptId: string;
      quoteId: string;
      txBase64: string;
      name: string;
      serial: string;
      backgroundId: number;
      metadataUri: string;
      imageUri: string;
    }
  | { ok: false; error: string };

type SubmitRes =
  | { ok: true; signature: string; explorer?: string; status?: string }
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

function short(addr: string) {
  return addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "";
}

export default function MintTestPage() {
  const wallet = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [showWallets, setShowWallets] = useState(false);
  const [busy, setBusy] = useState(false);

  const [quote, setQuote] = useState<QuoteRes | null>(null);
  const [build, setBuild] = useState<BuildRes | null>(null);
  const [submit, setSubmit] = useState<SubmitRes | null>(null);
  const [log, setLog] = useState<string>("");

  const pubkey = useMemo(() => wallet.publicKey?.toBase58() || "", [wallet.publicKey]);

  // HARD ALLOW-LIST — only show these in our UI
  const allowed = useMemo(() => new Set(["Phantom", "Solflare", "Backpack"]), []);

  const allowedWallets = useMemo(() => {
    return wallet.wallets.filter((w) => allowed.has(w.adapter.name));
  }, [wallet.wallets, allowed]);

  async function doQuote() {
    if (!pubkey) return;
    setBusy(true);
    setLog("");
    setBuild(null);
    setSubmit(null);

    try {
      const r = await fetch(`/api/mint/quote?wallet=${pubkey}`, { cache: "no-store" });
      const j = (await r.json()) as QuoteRes;
      setQuote(j);
      setLog((s) => s + "\nQUOTE:\n" + JSON.stringify(j, null, 2));
    } catch (e: any) {
      setQuote({ ok: false, error: e?.message ?? "quote failed" });
    } finally {
      setBusy(false);
    }
  }

  async function doBuild() {
    if (!pubkey) return;
    if (!quote || quote.ok === false) return;

    setBusy(true);
    setSubmit(null);

    try {
      const r = await fetch("/api/mint/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: pubkey, quoteId: quote.quoteId }),
      });
      const j = (await r.json()) as BuildRes;
      setBuild(j);
      setLog((s) => s + "\n\nBUILD:\n" + JSON.stringify(j, null, 2));
    } catch (e: any) {
      setBuild({ ok: false, error: e?.message ?? "build failed" });
    } finally {
      setBusy(false);
    }
  }

  async function doSignAndSubmit() {
    if (!wallet.connected || !wallet.publicKey) return;
    if (!wallet.signTransaction) {
      alert("Wallet does not support signTransaction()");
      return;
    }
    if (!build || build.ok === false) return;

    const b = build as Extract<BuildRes, { ok: true }>;
    setBusy(true);

    try {
      const raw = base64ToBytes(b.txBase64);
      let signedBytes: Uint8Array;

      try {
        const v0 = VersionedTransaction.deserialize(raw);
        const signed = await wallet.signTransaction(v0 as any);
        signedBytes = signed.serialize();
      } catch {
        const legacy = Transaction.from(raw);
        const signed = await wallet.signTransaction(legacy as any);
        signedBytes = signed.serialize();
      }

      const signedTxBase64 = bytesToBase64(signedBytes);

      const r = await fetch("/api/mint/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: b.attemptId, signedTxBase64 }),
      });

      const j = (await r.json()) as SubmitRes;
      setSubmit(j);
      setLog((s) => s + "\n\nSUBMIT:\n" + JSON.stringify(j, null, 2));
    } catch (e: any) {
      setSubmit({ ok: false, error: e?.message ?? "submit failed" });
    } finally {
      setBusy(false);
    }
  }

  async function connectWallet(name: WalletName<string>) {
    try {
      setShowWallets(false);
      wallet.select(name);
      await wallet.connect();
    } catch (e) {
      console.error("connect error", e);
    }
  }

  async function disconnectWallet() {
    try {
      await wallet.disconnect();
      setQuote(null);
      setBuild(null);
      setSubmit(null);
      setLog("");
    } catch (e) {
      console.error("disconnect error", e);
    }
  }

  if (!mounted) return null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Mint Test</h1>
      <p style={{ opacity: 0.8 }}>quote → build → sign+submit</p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "16px 0" }}>
        {!wallet.connected ? (
          <>
            <button onClick={() => setShowWallets(true)}>Select Wallet</button>
            {showWallets && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 9999,
                }}
                onClick={() => setShowWallets(false)}
              >
                <div
                  style={{ width: 360, background: "#111", color: "#fff", padding: 16, borderRadius: 12 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>Connect a wallet</div>
                    <button onClick={() => setShowWallets(false)}>✕</button>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {allowedWallets.map((w) => (
                      <button
                        key={w.adapter.name}
                        onClick={() => connectWallet(w.adapter.name as any)}
                        style={{ padding: 10, textAlign: "left" }}
                      >
                        {w.adapter.name}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
                    Only Phantom, Solflare, and Backpack are supported.
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ padding: "6px 10px", borderRadius: 8, background: "#eee" }}>
              {wallet.wallet?.adapter?.name} — {short(pubkey)}
            </div>
            <button onClick={disconnectWallet}>Disconnect</button>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button disabled={!wallet.connected || busy} onClick={doQuote}>
          1) Quote
        </button>
        <button disabled={!wallet.connected || busy || !quote || quote.ok === false} onClick={doBuild}>
          2) Build
        </button>
        <button disabled={!wallet.connected || busy || !build || build.ok === false} onClick={doSignAndSubmit}>
          3) Sign + Submit (spends SOL)
        </button>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20 }}>Log</h2>
      <pre style={{ whiteSpace: "pre-wrap", background: "#111", color: "#ddd", padding: 12, borderRadius: 8 }}>
        {log || "(no output yet)"}
      </pre>

      {submit && (
        <div style={{ marginTop: 12 }}>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(submit, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
