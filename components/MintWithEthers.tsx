"use client";

import { useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import nftBingoABI from "@/lib/nftBingoABI.json";
import { CONTRACT_ADDRESS } from "@/lib/cardGenerator/config";

const POLYGON_AMOY_CHAIN_ID_DEC = 80002;
const POLYGON_AMOY_CHAIN_ID_HEX = "0x13882"; // 80002 in hex

export default function MintWithEthers() {
  const [isMinting, setIsMinting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleMint = async () => {
    try {
      setErrorMsg(null);

      if (typeof window === "undefined" || !(window as any).ethereum) {
        setErrorMsg("No wallet found. Install MetaMask or a compatible wallet.");
        return;
      }

      const ethereum = (window as any).ethereum;

      // 1) Create provider from injected wallet
      const provider = new BrowserProvider(ethereum);

      // 2) Ensure we are on Polygon Amoy testnet
      const network = await provider.getNetwork();
      const currentChainId = Number(network.chainId.toString());

      console.log("Current network:", {
        chainId: currentChainId,
        name: network.name,
      });

      if (currentChainId !== POLYGON_AMOY_CHAIN_ID_DEC) {
        console.log("Switching chain to Polygon Amoy…");
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: POLYGON_AMOY_CHAIN_ID_HEX }],
        });
      }

      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      console.log("Using signer:", signerAddress);
      console.log("Contract address:", CONTRACT_ADDRESS);

      // 3) Connect to the contract
      const contract = new Contract(CONTRACT_ADDRESS, nftBingoABI, signer);

      // 4) Call mintCard(seriesId)
      setIsMinting(true);

      // If your contract expects something other than `1`, change this.
      const seriesId = BigInt(1); // or BigInt("1")

      console.log("Calling mintCard with seriesId:", seriesId);

      const tx = await contract.mintCard(seriesId);
      console.log("✅ Mint tx sent:", tx.hash);

      const receipt = await tx.wait();
      console.log("✅ Mint confirmed:", receipt);
    } catch (err: any) {
      console.error("❌ Mint failed:", err);

      const friendly =
        err?.reason ||
        err?.data?.message ||
        err?.message ||
        "Mint failed. Check console for details.";

      setErrorMsg(friendly);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleMint}
        disabled={isMinting}
        className="px-8 py-3 rounded-full bg-pink-500 text-white font-semibold shadow-md hover:bg-pink-600 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isMinting ? "Minting…" : "Mint NFTBingo Card"}
      </button>

      {errorMsg && (
        <p className="text-sm text-red-500 text-center max-w-md">{errorMsg}</p>
      )}

      <p className="text-xs text-slate-400 text-center max-w-md">
        Make sure your wallet is connected and on the Polygon Amoy testnet.
      </p>
    </div>
  );
}
