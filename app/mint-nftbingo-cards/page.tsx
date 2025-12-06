"use client";

import React, { useState } from "react";
import {
  useAccount,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { decodeEventLog } from "viem";
import nftBingoABI from "@/lib/nftBingoABI.json";
import { CONTRACT_ADDRESS } from "@/lib/cardGenerator/config";

type CardOnchainData = {
  numbers: number[];
  backgroundId: number;
};

type GenerateCardResponse = {
  ok: boolean;
  message: string;
  tokenId: number;
  onchain?: CardOnchainData;
  imageDataUrl?: string;
};

// current series we're minting from
const SERIES_ID = BigInt(1);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export default function MintNFTBingoCardsPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const { writeContractAsync, isPending: isMintPending } = useWriteContract();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "minting" | "waiting" | "rendering" | "done"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateCardResponse | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  async function handleMintAndGenerate() {
    if (!address) {
      setError("Please connect your wallet first.");
      return;
    }

    if (!publicClient) {
      setError("Public client not available. Check your wagmi config.");
      return;
    }

    try {
      setLoading(true);
      setStatus("minting");
      setError(null);
      setResult(null);
      setTxHash(null);

      // 1) Send mint transaction
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: nftBingoABI,
        functionName: "mintCard",
        args: [SERIES_ID],
      });

      setTxHash(hash);
      setStatus("waiting");

      // 2) Wait for tx receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // 3) Find minted tokenId from TransferSingle event logs
      let mintedTokenId: number | null = null;

      for (const log of receipt.logs) {
        if (
          log.address.toLowerCase() ===
          (CONTRACT_ADDRESS as string).toLowerCase()
        ) {
          try {
            const decoded: any = decodeEventLog({
  abi: nftBingoABI as any,
  data: log.data,
  topics: log.topics,
});

            if (decoded.eventName === "TransferSingle") {
              const args: any = decoded.args;
              if (
                args.from &&
                args.from.toLowerCase() === ZERO_ADDRESS.toLowerCase()
              ) {
                mintedTokenId = Number(args.id);
                break;
              }
            }
          } catch {
            // not our event, ignore
          }
        }
      }

      if (mintedTokenId === null) {
        throw new Error("Could not determine minted tokenId from logs.");
      }

      // 4) Generate the card image for that tokenId
      setStatus("rendering");

      const res = await fetch(`/api/generate-card?tokenId=${mintedTokenId}`);
      if (!res.ok) {
        throw new Error(
          `Generator request failed with status ${res.status}`
        );
      }

      const data = (await res.json()) as GenerateCardResponse;
      if (!data.ok) {
        throw new Error(data.message || "Generator API returned an error.");
      }

      setResult(data);
      setStatus("done");
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Something went wrong while minting.");
      setStatus("idle");
    } finally {
      setLoading(false);
    }
  }

  const isBusy = loading || isMintPending;
  const polygonscanUrl = txHash
    ? `https://amoy.polygonscan.com/tx/${txHash}`
    : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100 px-6 py-16">
      <div className="max-w-4xl mx-auto">
        {/* Page Title */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 text-center">
          Mint NFTBingo Cards
        </h1>

        <p className="text-lg text-slate-700 mb-10 text-center max-w-2xl mx-auto">
          Mint a random, on-chain NFTBingo card on the Polygon Amoy test
          network. Each click mints a new card and then renders the full PNG
          using the numbers and background stored in your smart contract.
        </p>

        {/* Main Card Box */}
        <div className="bg-white rounded-2xl shadow p-8 md:p-10">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">
            Step 1 — Mint &amp; Generate Your Card
          </h2>

          {/* Mint Button */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <button
              type="button"
              onClick={handleMintAndGenerate}
              disabled={isBusy}
              className="cursor-pointer bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === "minting"
                ? "Sending mint transaction..."
                : status === "waiting"
                ? "Waiting for confirmation..."
                : status === "rendering"
                ? "Generating card image..."
                : "Mint NFTBingo Card"}
            </button>

            <p className="text-sm text-slate-500 text-center">
              Clicking this button will mint a brand new NFTBingo card to your
              connected wallet, then render the card using the on-chain
              numbers. There is no preview step — each mint is final.
            </p>

            {polygonscanUrl && (
              <a
                href={polygonscanUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:underline"
              >
                View transaction on PolygonScan
              </a>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-rose-700 text-sm mb-6">
              Error: {error}
            </div>
          )}

          {/* Result */}
          {result && result.ok && result.onchain && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                <span className="font-semibold">
                  Token ID:{" "}
                  <span className="font-bold text-slate-900">
                    {result.tokenId}
                  </span>
                </span>

                <span className="font-semibold">
                  Background ID:{" "}
                  <span className="font-bold text-slate-900">
                    {result.onchain.backgroundId}
                  </span>
                </span>

                <span className="text-slate-500">
                  ({result.message})
                </span>
              </div>

              {/* Card Image */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Your Minted Card
                </h3>

                {result.imageDataUrl ? (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
                    <img
                      src={result.imageDataUrl}
                      alt="Generated NFTBingo card"
                      className="w-full h-auto block"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No image was returned from the generator.
                  </p>
                )}

                <p className="mt-2 text-xs text-slate-500">
                  This PNG is rendered on the server using @napi-rs/canvas and
                  your bingo card layout template, based on the random numbers
                  and background stored in your contract.
                </p>
              </div>
            </div>
          )}

          {!error && !result && !isBusy && (
            <p className="mt-4 text-sm text-slate-500">
              Connect your wallet, then click the button above to mint and view
              a brand new NFTBingo card.
            </p>
          )}

          {/* Future Step */}
          <div className="border-t border-slate-200 pt-6 mt-10">
            <h3 className="text-xl font-semibold text-indigo-600 mb-2">
              Next — Metadata & Secondary Markets
            </h3>

            <p className="text-slate-700 mb-4">
              With minting and card rendering wired up, the next steps will be
              wiring your metadata endpoint (so marketplaces like OpenSea or
              Rarible show the same image) and polishing the UX around minted
              cards.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
