"use client";

import React, { useState } from "react";
import { ethers } from "ethers";
import nftBingoABI from "@/lib/nftBingoABI.json";
import { CONTRACT_ADDRESS } from "@/lib/cardGenerator/config";

const AMOY_CHAIN_ID = 80002;

export default function MintNFTBingoCardsPage() {
  const [status, setStatus] = useState<string>("");
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);

  async function handleMint() {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      setStatus("No wallet found. Please install MetaMask.");
      return;
    }

    setStatus("Connecting wallet…");
    setIsMinting(true);
    setMintedTokenId(null);

    try {
      const browserProvider = new ethers.BrowserProvider(
        (window as any).ethereum
      );

      // Make sure we're on Polygon Amoy
      const network = await browserProvider.getNetwork();
      const currentChainId = Number(network.chainId);
      if (currentChainId !== AMOY_CHAIN_ID) {
        setStatus("Please switch your wallet to Polygon Amoy testnet.");
        setIsMinting(false);
        return;
      }

      const signer = await browserProvider.getSigner();
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        nftBingoABI as any,
        signer
      );

      const seriesId = BigInt(1); // your only series for now

      // ---------- Gas estimation ----------
      let gasLimitOverride: bigint | undefined = undefined;

      try {
        const estimatedGas: bigint = await contract.mintCard.estimateGas(
          seriesId
        );
        // bump by 20% to be safe
        const bumpNumerator = BigInt(12);
        const bumpDenominator = BigInt(10);
        gasLimitOverride =
          (estimatedGas * bumpNumerator) / bumpDenominator;

        console.log(
          "[mint] Estimated gas:",
          estimatedGas.toString(),
          "Using gasLimit override:",
          gasLimitOverride.toString()
        );
      } catch (gasErr) {
        console.warn("[mint] Gas estimation failed, sending without override");
        console.warn(gasErr);
      }

      setStatus("Sending transaction…");

      const tx = await contract.mintCard(
        seriesId,
        gasLimitOverride ? { gasLimit: gasLimitOverride } : {}
      );

      console.log("[mint] Tx sent:", tx.hash);
      setStatus("Transaction sent. Waiting for confirmation…");

      const receipt = await tx.wait();
      console.log("[mint] Tx confirmed:", receipt);

      // ---------- Parse logs to find minted tokenId ----------
      const iface = new ethers.Interface(nftBingoABI as any);
      let newTokenId: number | null = null;

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);

          // IMPORTANT: parsed may be null
          if (!parsed) continue;

          if (parsed.name === "TransferSingle") {
            // ERC-1155 TransferSingle(operator, from, to, id, value)
            const idBig = parsed.args["id"] as bigint;
            newTokenId = Number(idBig);
            break;
          }
        } catch (e) {
          // Not our event, ignore
        }
      }

      if (newTokenId === null) {
        console.warn(
          "[mint] Mint succeeded but tokenId could not be parsed from logs"
        );
        setStatus("Mint succeeded, but token ID could not be parsed.");
      } else {
        console.log("[mint] Mint successful, tokenId =", newTokenId);
        setStatus(`Mint successful! Token #${newTokenId}`);
        setMintedTokenId(newTokenId);
      }
    } catch (err: any) {
      console.error("[mint] Mint error:", err);

      // Try to show the raw RPC error if present
      const rawMsg =
        err?.error?.message ||
        err?.data?.message ||
        err?.message ||
        "Unknown error while sending transaction.";

      setStatus(`Transaction failed: ${rawMsg}`);
    } finally {
      setIsMinting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="max-w-4xl mx-auto py-16 px-4">
        <h1 className="text-4xl font-extrabold text-center mb-4 text-gray-900">
          Mint NFTBingo Cards
        </h1>
        <p className="text-center text-gray-600 mb-10 max-w-2xl mx-auto">
          Mint a random, on-chain NFTBingo card on the Polygon Amoy test
          network. Each click mints a new card and then renders the full PNG
          using the numbers and background stored in your smart contract.
        </p>

        <div className="bg-white rounded-3xl shadow-lg px-8 py-10 mb-10 border border-pink-100">
          <h2 className="text-2xl font-bold text-center mb-2">
            Step 1 — Mint &amp; Generate Your Card
          </h2>
          <p className="text-center text-gray-600 mb-6">
            Clicking this button will mint a brand new NFTBingo card to your
            connected wallet, then render the card using the on-chain numbers.
            There is no preview step — each mint is final.
          </p>

          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleMint}
              disabled={isMinting}
              className="px-8 py-3 rounded-full bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white font-semibold shadow-md transition"
            >
              {isMinting ? "Minting…" : "Mint NFTBingo Card"}
            </button>

            {status && (
              <p className="text-sm text-gray-700 text-center max-w-md">
                {status}
              </p>
            )}
          </div>

          {mintedTokenId !== null && (
            <div className="mt-8 flex flex-col items-center">
              <h3 className="font-semibold mb-2">
                Latest Minted Card (Token #{mintedTokenId})
              </h3>
              {/* Uses your existing card-image API */}
              <img
                src={`/api/card-image/${mintedTokenId}`}
                alt={`NFTBingo card #${mintedTokenId}`}
                className="w-full max-w-md rounded-xl shadow"
              />
            </div>
          )}
        </div>

        <div className="bg-gray-50 rounded-3xl px-8 py-8 border border-gray-100">
          <h2 className="text-xl font-bold mb-2 text-center">
            Next — Metadata &amp; Secondary Markets
          </h2>
          <p className="text-center text-gray-600 max-w-2xl mx-auto">
            This mint process is currently set on the Polygon Amoy test network.
            After minting, you can view your NFTBingo cards in your wallet, but 
            they are test network NFTs only and will not be available for gameplay.
          </p>
        </div>
      </section>
    </main>
  );
}
