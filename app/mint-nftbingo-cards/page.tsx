"use client";

import React, { useState } from "react";
import { ethers } from "ethers";
import nftBingoABI from "@/lib/nftBingoABI.json";
import { CONTRACT_ADDRESS } from "@/lib/cardGenerator/config";

declare global {
  interface Window {
    ethereum?: any;
  }
}

type MintStatus = "idle" | "wallet" | "pending" | "success" | "error";

export default function MintNftBingoCardsPage() {
  const [isMinting, setIsMinting] = useState(false);
  const [status, setStatus] = useState<MintStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);

  const handleMint = async () => {
    // reset any previous state
    setMintedTokenId(null);
    setStatus("idle");
    setStatusMessage(null);

    try {
      if (!window.ethereum) {
        setStatus("error");
        setStatusMessage("No wallet detected. Please connect your wallet.");
        return;
      }

      setIsMinting(true);
      setStatus("wallet");
      setStatusMessage("Opening your wallet…");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      // Polygon Amoy chainId is 80002
      const chainIdNum = Number(network.chainId);
      if (chainIdNum !== 80002) {
        setStatus("error");
        setStatusMessage("Please switch your wallet to the Polygon Amoy testnet.");
        return;
      }

      const signer = await provider.getSigner();
      const userAddress = (await signer.getAddress()).toLowerCase();

      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        nftBingoABI as any,
        signer
      );

      const seriesId = 1; // Series 1 for now

      setStatus("pending");
      setStatusMessage(
        "Sending mint transaction… please confirm in your wallet."
      );

      const tx = await contract.mintCard(seriesId, {
        // fixed gas limit so Amoy’s flaky estimation doesn’t kill us
        gasLimit: 1000000,
      });

      setStatusMessage("Transaction sent. Waiting for confirmation…");
      const receipt = await tx.wait();

      console.log("✅ Mint tx receipt:", receipt);

      // ---- Extract tokenId from TransferSingle event ----
      let newTokenId: number | null = null;

      for (const log of receipt.logs ?? []) {
  try {
    const parsed: any = contract.interface.parseLog({
      topics: [...log.topics],
      data: log.data,
    });

    // TypeScript worry fix: make sure we bail if parsed is falsy
    if (!parsed || parsed.name !== "TransferSingle") continue;

    const from = (parsed.args.from as string).toLowerCase();
    const to = (parsed.args.to as string).toLowerCase();
    const id = parsed.args.id as bigint | number;

    if (
      from === ethers.ZeroAddress.toLowerCase() &&
      to === userAddress
    ) {
      newTokenId = Number(id);
      break;
    }
  } catch {
    // not a TransferSingle we understand – skip
  }
}

      if (newTokenId == null) {
        // Mint probably succeeded but we couldn't decode the id
        setStatus("success");
        setStatusMessage(
          "Mint appears to have succeeded, but I couldn’t read the new token ID. Please check your wallet or PolygonScan."
        );
        return;
      }

      setMintedTokenId(newTokenId);
      setStatus("success");
      setStatusMessage(`Mint successful! Your new card is #${newTokenId}.`);
    } catch (err: any) {
      console.error("❌ Mint error (ethers):", err);

      let message = "Unexpected error while minting. Please try again.";

      if (err?.code === "ACTION_REJECTED") {
        message = "Transaction rejected in wallet.";
      } else if (typeof err?.message === "string") {
        if (err.message.includes("Internal JSON-RPC error")) {
          message =
            "The Amoy testnet RPC had an internal error. Wait a few seconds and try again — that testnet has been flaky.";
        } else {
          message = err.message;
        }
      }

      setStatus("error");
      setStatusMessage(message);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <main className="flex flex-col items-center px-4 py-16">
      {/* Page header */}
      <section className="max-w-4xl w-full text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
          Mint NFTBingo Cards
        </h1>
        <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto">
          Mint a random, on-chain NFTBingo card on the Polygon Amoy test
          network. Each click mints a new card and then renders the full PNG
          using the numbers and background stored in your smart contract.
        </p>
      </section>

      {/* Mint card */}
      <section className="max-w-3xl w-full bg-white rounded-3xl shadow-lg px-6 sm:px-10 py-10 border border-slate-100">
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-4">
          Step 1 — Mint &amp; Generate Your Card
        </h2>

        <p className="text-slate-600 text-sm sm:text-base text-center mb-8 max-w-2xl mx-auto">
          Clicking this button will mint a brand new NFTBingo card to your
          connected wallet, then render the card using the on-chain numbers.
          There is no preview step — each mint is final.
        </p>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleMint}
            disabled={isMinting}
            className={`px-8 py-3 rounded-full text-white font-semibold shadow-md transition-transform ${
              isMinting
                ? "bg-pink-300 cursor-not-allowed"
                : "bg-pink-500 hover:bg-pink-600 hover:-translate-y-0.5"
            }`}
          >
            {isMinting ? "Minting…" : "Mint NFTBingo Card"}
          </button>
        </div>

        {/* Status message under the button */}
        {statusMessage && (
          <p
            className={`mt-4 text-sm text-center ${
              status === "error"
                ? "text-red-500"
                : status === "success"
                ? "text-green-600"
                : "text-slate-500"
            }`}
          >
            {statusMessage}
          </p>
        )}

        {/* Minted card preview */}
        {mintedTokenId !== null && (
          <div className="mt-10 flex justify-center">
            <img
              src={`/api/card-image/${mintedTokenId}`}
              alt={`NFTBingo Card #${mintedTokenId}`}
              className="w-full max-w-md rounded-2xl shadow-xl border border-slate-200"
            />
          </div>
        )}
      </section>

      {/* Next steps blurb */}
      <section className="max-w-3xl w-full mt-10 text-center">
        <h3 className="text-xl font-semibold mb-2">
          Next — Metadata &amp; Secondary Markets
        </h3>
        <p className="text-slate-600 text-sm sm:text-base">
          With minting and card rendering wired up, the next steps will be
          wiring your metadata endpoint (so marketplaces like OpenSea or
          Rarible show the same image) and then polishing the UX around minted
          cards.
        </p>
      </section>
    </main>
  );
}
