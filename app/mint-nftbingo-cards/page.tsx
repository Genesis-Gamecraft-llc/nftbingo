"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import SolanaConnectButton from "@/components/SolanaConnectButton";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

type MintResponse = {
  ok: boolean;
  error?: string;

  owner?: string;
  assetAddress?: string;
  metadataUri?: string;
  imageUri?: string;
  signature?: string;

  explorer?: {
    asset?: string;
    tx?: string;
  };

  numbers?: number[];
  columns?: {
    B: number[];
    I: number[];
    N: number[];
    G: number[];
    O: number[];
  };

  chosenBackgroundPath?: string;
  chosenBackgroundId?: number;
  backgroundFallbackUsed?: boolean;
};

function formatSol(lamports: number) {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

export default function MintNFTBingoCardsPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const [status, setStatus] = useState<string>("");
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [isAirdropping, setIsAirdropping] = useState<boolean>(false);

  // prevents faucet spam / rate-limit hammering
  const [nextAirdropAt, setNextAirdropAt] = useState<number>(0);

  const [mint, setMint] = useState<MintResponse | null>(null);

  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);
  const balanceSol = useMemo(
    () => (balanceLamports === null ? null : formatSol(balanceLamports)),
    [balanceLamports]
  );

  const refreshBalance = useCallback(async () => {
    if (!publicKey) {
      setBalanceLamports(null);
      return;
    }
    try {
      const lamports = await connection.getBalance(publicKey, "confirmed");
      setBalanceLamports(lamports);
    } catch (e: any) {
      setStatus(e?.message ?? "Failed to fetch balance.");
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  async function handleAirdrop() {
    if (!publicKey) {
      setStatus("Connect your Solana wallet first.");
      return;
    }

    const now = Date.now();
    if (now < nextAirdropAt) {
      const secs = Math.ceil((nextAirdropAt - now) / 1000);
      setStatus(`Faucet cooldown active. Try again in ${secs}s.`);
      return;
    }

    setIsAirdropping(true);
    setStatus("Requesting Devnet SOL…");

    try {
      // Request smaller amount to reduce rate-limit hits
      const amountLamports = Math.floor(0.2 * LAMPORTS_PER_SOL);

      const sig = await connection.requestAirdrop(publicKey, amountLamports);

      const latest = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction(
        { signature: sig, ...latest },
        "confirmed"
      );

      await refreshBalance();
      setStatus("Devnet SOL received. You can mint now.");
      // short cooldown even on success (prevents spam)
      setNextAirdropAt(Date.now() + 30_000);
    } catch (e: any) {
      const msg = String(e?.message ?? e);

      // handle common rate-limit / 429 / faucet limits
      const lower = msg.toLowerCase();
      const isRateLimited =
        msg.includes("429") ||
        lower.includes("rate limit") ||
        lower.includes("too many") ||
        lower.includes("airdrop request failed");

      if (isRateLimited) {
        setStatus(
          "Devnet faucet is rate-limited (429) or you hit a faucet limit. Wait 1–5 minutes and try again, or use an alternate faucet link below."
        );
        // Longer cooldown after rate limit
        setNextAirdropAt(Date.now() + 90_000);
      } else {
        setStatus(msg);
        setNextAirdropAt(Date.now() + 30_000);
      }
    } finally {
      setIsAirdropping(false);
    }
  }

  async function handleMint() {
    if (!publicKey) {
      setStatus("Connect your Solana wallet first.");
      return;
    }

    setIsMinting(true);
    setMint(null);
    setStatus(
      "Minting on Solana Devnet… selecting a random Founders background, generating numbers, rendering the card, uploading to Arweave…"
    );

    try {
      const res = await fetch("/api/solana/mint-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: publicKey.toBase58(),
          name: "NFTBingo Founders (Devnet Test)",
          description:
            "Founders Series devnet test mint. Background randomly selected. Image + metadata stored permanently on Arweave. Card numbers follow standard bingo rules.",
        }),
      });

      const data = (await res.json()) as MintResponse;

      if (!res.ok || !data.ok) {
        setStatus(data?.error || `Mint failed (HTTP ${res.status}).`);
        setMint(data);
        return;
      }

      setMint(data);
      setStatus("Mint successful — minted to your connected wallet (Devnet).");

      await refreshBalance();
    } catch (err: any) {
      setStatus(err?.message ?? "Unknown error while minting.");
    } finally {
      setIsMinting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="max-w-4xl mx-auto py-16 px-4">
        <h1 className="text-4xl font-extrabold text-center mb-4 text-gray-900">
          Mint NFTBingo Founders Cards
        </h1>

        <p className="text-center text-gray-600 mb-10 max-w-2xl mx-auto">
          This page mints <span className="font-semibold">test NFTs</span> on the{" "}
          <span className="font-semibold">Solana Devnet</span>. You’ll need a small amount of{" "}
          <span className="font-semibold">Devnet SOL</span> to run transactions. Use the faucet
          button below to request Devnet SOL to your connected wallet.
        </p>

        <div className="bg-white rounded-3xl shadow-lg px-8 py-10 mb-10 border border-pink-100">
          <h2 className="text-2xl font-bold text-center mb-6">
            Connect, Fund (Devnet), Mint
          </h2>

          <div className="flex flex-col items-center gap-4">
            <SolanaConnectButton />

            <div className="text-sm text-gray-700 text-center">
              <div>
                Network: <span className="font-semibold">Solana Devnet</span>
              </div>

              <div className="mt-1">
                Balance:{" "}
                <span className="font-mono font-semibold">
                  {connected
                    ? balanceSol === null
                      ? "…"
                      : `${balanceSol} SOL`
                    : "—"}
                </span>
              </div>

              {publicKey && (
                <div className="mt-1 text-xs text-gray-500">
                  Wallet: <span className="font-mono">{publicKey.toBase58()}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <button
                onClick={handleAirdrop}
                disabled={!publicKey || isAirdropping}
                className="px-6 py-3 rounded-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold shadow-md transition"
              >
                {isAirdropping ? "Requesting…" : "Get 0.2 Devnet SOL (Faucet)"}
              </button>

              <button
                onClick={refreshBalance}
                disabled={!publicKey}
                className="px-6 py-3 rounded-full bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-800 font-semibold shadow-sm transition"
              >
                Refresh Balance
              </button>

              <button
                onClick={handleMint}
                disabled={!publicKey || isMinting}
                className="px-8 py-3 rounded-full bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white font-semibold shadow-md transition"
              >
                {isMinting ? "Minting…" : "Mint Founders Card"}
              </button>
            </div>

            <div className="text-xs text-gray-500 text-center max-w-2xl">
              If the faucet hits rate limits, wait a few minutes and try again, or use an alternate
              faucet:{" "}
              <a
                className="text-pink-600 hover:underline"
                href="https://solfaucet.com"
                target="_blank"
                rel="noreferrer"
              >
                solfaucet.com
              </a>
              .
            </div>

            {status && (
              <p className="text-sm text-gray-700 text-center max-w-2xl">
                {status}
              </p>
            )}
          </div>

          {mint?.ok && mint.imageUri && (
            <div className="mt-10">
              <h3 className="text-xl font-bold text-center mb-4">
                Latest Mint Result
              </h3>

              <div className="flex flex-col items-center gap-4">
                <img
                  src={mint.imageUri}
                  alt="Minted NFTBingo card"
                  className="w-full max-w-md rounded-xl shadow"
                />

                <div className="w-full max-w-2xl bg-gray-50 border border-gray-100 rounded-2xl p-5">
                  <div className="text-sm text-gray-800 space-y-2">
                    {mint.chosenBackgroundPath && (
                      <div>
                        <span className="font-semibold">Background:</span>{" "}
                        <span className="font-mono break-all">{mint.chosenBackgroundPath}</span>
                        {mint.backgroundFallbackUsed ? (
                          <span className="ml-2 text-xs text-amber-700">(fallback used)</span>
                        ) : null}
                      </div>
                    )}

                    {mint.assetAddress && (
                      <div>
                        <span className="font-semibold">Asset Address:</span>{" "}
                        <span className="font-mono break-all">{mint.assetAddress}</span>
                      </div>
                    )}

                    {mint.signature && (
                      <div>
                        <span className="font-semibold">Tx Signature:</span>{" "}
                        <span className="font-mono break-all">{mint.signature}</span>
                      </div>
                    )}

                    {mint.metadataUri && (
                      <div>
                        <span className="font-semibold">Metadata:</span>{" "}
                        <a
                          href={mint.metadataUri}
                          target="_blank"
                          rel="noreferrer"
                          className="text-pink-600 hover:underline break-all"
                        >
                          {mint.metadataUri}
                        </a>
                      </div>
                    )}

                    {mint.imageUri && (
                      <div>
                        <span className="font-semibold">Image:</span>{" "}
                        <a
                          href={mint.imageUri}
                          target="_blank"
                          rel="noreferrer"
                          className="text-pink-600 hover:underline break-all"
                        >
                          {mint.imageUri}
                        </a>
                      </div>
                    )}

                    {(mint.explorer?.tx || mint.explorer?.asset) && (
                      <div className="pt-2 flex flex-col gap-1">
                        {mint.explorer?.tx && (
                          <a
                            href={mint.explorer.tx}
                            target="_blank"
                            rel="noreferrer"
                            className="text-pink-600 hover:underline break-all"
                          >
                            View Transaction on Solana Explorer (Devnet)
                          </a>
                        )}
                        {mint.explorer?.asset && (
                          <a
                            href={mint.explorer.asset}
                            target="_blank"
                            rel="noreferrer"
                            className="text-pink-600 hover:underline break-all"
                          >
                            View Asset on Solana Explorer (Devnet)
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {mint.columns && (
                  <div className="w-full max-w-2xl bg-white border border-gray-100 rounded-2xl p-5">
                    <h4 className="font-semibold mb-3">Bingo Columns (Quick Check)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
                      {(["B", "I", "N", "G", "O"] as const).map((k) => (
                        <div
                          key={k}
                          className="bg-gray-50 rounded-xl p-3 border border-gray-100"
                        >
                          <div className="font-bold mb-2">{k}</div>
                          <div className="font-mono whitespace-pre-wrap">
                            {(mint.columns?.[k] ?? [])
                              .map((n) => (n === 0 ? "FREE" : String(n)))
                              .join(", ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 rounded-3xl px-8 py-8 border border-gray-100">
          <h2 className="text-xl font-bold mb-2 text-center">
            Solana Devnet Test Network Notice
          </h2>
          <p className="text-center text-gray-600 max-w-2xl mx-auto">
            This is Devnet only. These test NFTs are for validating minting, metadata, and card
            rendering. Mainnet minting will be enabled later.
          </p>
        </div>
      </section>
    </main>
  );
}
