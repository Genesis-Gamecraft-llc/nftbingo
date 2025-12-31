"use client";

import React, { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
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

  // Optional debug info (if returned)
  chosenBackgroundPath?: string;
  chosenBackgroundId?: number;
  backgroundFallbackUsed?: boolean;
};

function shortAddr(addr: string, front = 6, back = 4) {
  if (!addr) return "";
  if (addr.length <= front + back + 3) return addr;
  return `${addr.slice(0, front)}…${addr.slice(-back)}`;
}

export default function MintNFTBingoCardsPage() {
  const { publicKey } = useWallet();
  const owner = useMemo(() => publicKey?.toBase58() ?? null, [publicKey]);

  const [status, setStatus] = useState<string>("");
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [mint, setMint] = useState<MintResponse | null>(null);

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

        // IMPORTANT:
        // - DO NOT send backgroundPath — server randomizes (and falls back to bg0 if missing).
        // - We DO send owner so the server mints to the connected wallet.
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
        "Mint successful! Your devnet test NFT is minted to your connected wallet, and the image/metadata are stored on Arweave."
      );
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
          <span className="font-semibold">Solana Devnet</span>. It is only intended
          for testing purposes. None of these test assets will have financial value
          on the Mainnet. Feel free to test the generator as many times as you like!
        </p>

        <div className="bg-white rounded-3xl shadow-lg px-8 py-10 mb-10 border border-pink-100">
          <h2 className="text-2xl font-bold text-center mb-2">
            Mint a Random Founders Card (Devnet)
          </h2>

          <p className="text-center text-gray-600 mb-6">
            Click to generate one randomly selected Founders Series NFTBingo card
            with randomly chosen bingo numbers.
          </p>

          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <SolanaConnectButton />
              <div className="text-xs text-gray-600">
                {owner ? (
                  <>
                    Connected:{" "}
                    <span className="font-mono font-semibold">
                      {shortAddr(owner)}
                    </span>
                  </>
                ) : (
                  <>Not connected</>
                )}
              </div>
            </div>

            <button
              onClick={handleMint}
              disabled={isMinting || !owner}
              className="px-8 py-3 rounded-full bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white font-semibold shadow-md transition"
            >
              {isMinting ? "Minting…" : "Mint Random Founders Card"}
            </button>

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
                      </div>
                    )}

                    {typeof mint.chosenBackgroundId === "number" && (
                      <div>
                        <span className="font-semibold">Background ID:</span>{" "}
                        <span className="font-mono">{mint.chosenBackgroundId}</span>
                      </div>
                    )}

                    {typeof mint.backgroundFallbackUsed === "boolean" && (
                      <div>
                        <span className="font-semibold">Fallback Used:</span>{" "}
                        <span className="font-mono">
                          {String(mint.backgroundFallbackUsed)}
                        </span>
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
            This page mints on <span className="font-semibold">Solana Devnet</span>{" "}
            only. These are test NFTs to validate the Founders mint pipeline and
            website UX. Wallets may label them as “Unverified Collection” until we
            set up and verify a proper collection on-chain.
          </p>
        </div>
      </section>
    </main>
  );
}
