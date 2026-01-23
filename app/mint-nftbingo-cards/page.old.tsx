"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import SolanaConnectButton from "@/components/SolanaConnectButton";

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

function shortAddr(addr: string, front = 6, back = 4) {
  if (!addr) return "";
  if (addr.length <= front + back + 3) return addr;
  return `${addr.slice(0, front)}…${addr.slice(-back)}`;
}

function formatSol(lamports?: number | null) {
  if (lamports === null || lamports === undefined) return "—";
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

export default function MintNFTBingoCardsPage() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const owner = useMemo(() => publicKey?.toBase58() ?? null, [publicKey]);

  const [status, setStatus] = useState<string>("");
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [mint, setMint] = useState<MintResponse | null>(null);

  const [isAirdropping, setIsAirdropping] = useState(false);
  const [nextAirdropAt, setNextAirdropAt] = useState<number>(0);

  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);

  async function refreshBalance() {
    if (!publicKey) {
      setBalanceLamports(null);
      return;
    }
    try {
      const lamports = await connection.getBalance(publicKey, "confirmed");
      setBalanceLamports(lamports);
    } catch {
      // don't spam status for balance polling
    }
  }

  useEffect(() => {
    refreshBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);

  async function handleAirdrop() {
    if (!publicKey) {
      setStatus("Connect your Solana wallet first (Devnet).");
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
      // Smaller amount reduces how often you hit rate limits
      const amountLamports = Math.floor(0.2 * LAMPORTS_PER_SOL);

      const sig = await connection.requestAirdrop(publicKey, amountLamports);

      const latest = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction(
        { signature: sig, ...latest },
        "confirmed"
      );

      await refreshBalance();
      setStatus("Devnet SOL received. You can mint now.");
      setNextAirdropAt(Date.now() + 30_000);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const lower = msg.toLowerCase();
      const isRateLimited =
        msg.includes("429") ||
        lower.includes("rate limit") ||
        lower.includes("too many") ||
        lower.includes("airdrop request failed");

      if (isRateLimited) {
        setStatus(
          "Devnet faucet is rate-limited (429) or you hit a daily faucet limit. Wait a few minutes and try again, or use an alternate faucet link below."
        );
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
    if (!owner) {
      setStatus("Connect your Solana wallet first (Devnet).");
      return;
    }

    setIsMinting(true);
    setMint(null);
    setStatus(
      "Minting on Solana Devnet… randomly selecting a Founders background, generating numbers, rendering the card, uploading to Arweave…"
    );

    try {
      const res = await fetch("/api/solana/mint-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          name: "NFTBingo Founders (Devnet Test)",
          description:
            "Founders Series devnet test mint. Background is randomly selected. Image + metadata stored permanently on Arweave. Card numbers follow standard bingo rules.",
        }),
      });

      const data = (await res.json()) as MintResponse;

      if (!res.ok || !data.ok) {
        const msg = data?.error || `Mint failed (HTTP ${res.status}).`;
        setStatus(msg);
        setMint(data);
        return;
      }

      setMint(data);
      setStatus(
        "Mint successful! Your devnet test NFT is minted to your connected wallet."
      );

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
          <span className="font-semibold">Solana Devnet</span>. Backgrounds are{" "}
          <span className="font-semibold">randomly selected</span> from the Founders pool.
        </p>

        <div className="bg-white rounded-3xl shadow-lg px-8 py-10 mb-10 border border-pink-100">
          <h2 className="text-2xl font-bold text-center mb-2">
            Mint a Random Founders Card (Devnet)
          </h2>

          <p className="text-center text-gray-600 mb-8">
            Connect your wallet, grab Devnet SOL if needed, then mint.
          </p>

          {/* Vertical inline stack */}
          <div className="flex flex-col items-center gap-3">
            <SolanaConnectButton />

            <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 text-center">
              <div className="text-xs text-gray-500">Connected Wallet</div>
              <div className="mt-1 font-mono text-sm text-gray-800">
                {owner ? owner : "Not connected"}
              </div>

              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="text-xs text-gray-500">Balance:</span>
                <span className="font-mono text-sm font-semibold text-gray-800">
                  {owner ? `${formatSol(balanceLamports)} SOL` : "—"}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={handleAirdrop}
                  disabled={!owner || isAirdropping}
                  className="w-full px-6 py-3 rounded-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold shadow-md transition"
                >
                  {isAirdropping ? "Requesting…" : "Get 0.2 Devnet SOL (Faucet)"}
                </button>

                <a
                  className="text-xs text-pink-600 hover:underline"
                  href="https://faucet.solana.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Alternate faucet: faucet.solana.com
                </a>
              </div>
            </div>

            <button
              onClick={handleMint}
              disabled={isMinting || !owner}
              className="mt-2 w-full max-w-md px-8 py-3 rounded-full bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white font-semibold shadow-md transition"
            >
              {isMinting ? "Minting…" : "Mint Random Founders Card"}
            </button>

            {status && (
              <p className="text-sm text-gray-700 text-center max-w-2xl mt-2">
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
                    {(mint.owner || owner) && (
                      <div>
                        <span className="font-semibold">Owner:</span>{" "}
                        <span className="font-mono break-all">
                          {mint.owner || owner}
                        </span>
                      </div>
                    )}

                    {mint.chosenBackgroundPath && (
                      <div>
                        <span className="font-semibold">Chosen Background:</span>{" "}
                        <span className="font-mono break-all">
                          {mint.chosenBackgroundPath}
                        </span>
                        {mint.backgroundFallbackUsed ? (
                          <span className="ml-2 text-xs text-amber-700">(fallback used)</span>
                        ) : null}
                      </div>
                    )}

                    {typeof mint.chosenBackgroundId === "number" && (
                      <div>
                        <span className="font-semibold">Background ID:</span>{" "}
                        <span className="font-mono">{mint.chosenBackgroundId}</span>
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
                        <span className="font-semibold">Metadata (Arweave):</span>{" "}
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
                        <span className="font-semibold">Image (Arweave):</span>{" "}
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
                            View Asset Address on Solana Explorer (Devnet)
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

                {mint.numbers && (
                  <div className="w-full max-w-2xl bg-white border border-gray-100 rounded-2xl p-5">
                    <h4 className="font-semibold mb-2">Raw Numbers (row-major-25)</h4>
                    <div className="font-mono text-sm break-words">
                      {JSON.stringify(mint.numbers)}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Note: the FREE center is stored as <span className="font-mono">0</span>.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 rounded-3xl px-8 py-8 border border-gray-100">
          <h2 className="text-xl font-bold mb-2 text-center">
            Solana Devnet Test Notice
          </h2>
          <p className="text-center text-gray-600 max-w-2xl mx-auto">
            Devnet only. These are test NFTs to validate the Founders mint pipeline and website UX.
            Wallets may label them as “Unverified Collection” until we set up and verify a collection.
          </p>
        </div>
      </section>
    </main>
  );
}
