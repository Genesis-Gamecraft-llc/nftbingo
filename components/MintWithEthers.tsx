"use client";

import { useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import nftBingoABI from "@/lib/nftBingoABI.json";
import { CONTRACT_ADDRESS } from "@/lib/cardGenerator/config";

// Use BigInt() explicitly so we don't rely on bigint literals
const AMOY_CHAIN_ID = BigInt(80002);

export default function MintWithEthers() {
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMint = async () => {
    setError(null);
    setTxHash(null);

    try {
      if (typeof window === "undefined") {
        throw new Error("Window is not available.");
      }

      const anyWindow = window as any;

      if (!anyWindow.ethereum) {
        throw new Error("Wallet not found. Please install MetaMask.");
      }

      // 1) Make sure we have permission to use the wallet
      await anyWindow.ethereum.request({
        method: "eth_requestAccounts",
      });

      // 2) Build provider from MetaMask
      const provider = new BrowserProvider(anyWindow.ethereum);

      // 3) Check we are on Polygon Amoy
      const network = await provider.getNetwork();
      if (network.chainId !== AMOY_CHAIN_ID) {
        throw new Error(
          "Wrong network. Please switch MetaMask to Polygon Amoy (chainId 80002)."
        );
      }

      // 4) Get signer & contract
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, nftBingoABI, signer);

      // Your contract: mintCard(uint256 seriesId)
      const seriesId = BigInt(1);

      setIsMinting(true);

      // Optional: gas estimation (just for logging)
      try {
        const estimate = await contract.mintCard.estimateGas(seriesId);
        console.log("Estimated gas for mintCard:", estimate.toString());
      } catch (gasErr) {
        console.error("Gas estimation failed for mintCard:", gasErr);
        // Continue anyway with explicit gasLimit
      }

      // 5) Send the tx with a manual gasLimit
      const tx = await contract.mintCard(seriesId, {
        gasLimit: BigInt(500_000),
      });

      console.log("Mint tx sent:", tx.hash);
      setTxHash(tx.hash);

      const receipt = await tx.wait();
      console.log("Mint tx confirmed:", receipt);
    } catch (err: any) {
      console.error("❌ Mint error (ethers):", err);

      if (err?.code === "ACTION_REJECTED") {
        setError("Transaction rejected in wallet.");
      } else if (err?.info?.error?.message) {
        setError(err.info.error.message);
      } else if (err?.error?.message) {
        setError(err.error.message);
      } else if (err?.shortMessage) {
        setError(err.shortMessage);
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError("Unknown error while sending transaction.");
      }
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleMint}
        disabled={isMinting}
        className="
          px-8 py-3 rounded-full
          bg-pink-600 hover:bg-pink-500
          text-white font-semibold text-lg
          shadow-md disabled:opacity-60 disabled:cursor-not-allowed
          transition-colors
        "
      >
        {isMinting ? "Minting…" : "Mint NFTBingo Card"}
      </button>

      {txHash && (
        <p className="text-sm text-green-600">
          Mint transaction submitted:{" "}
          <a
            href={`https://amoy.polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            View on Polygonscan
          </a>
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 text-center max-w-xl">
          {error}
        </p>
      )}
    </div>
  );
}
