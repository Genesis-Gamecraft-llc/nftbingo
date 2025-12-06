// lib/cardGenerator/fetchOnchain.ts

import { ethers } from "ethers";
import { RPC_URL, CONTRACT_ADDRESS } from "./config";

// Minimal ABI — only what we need from your contract
const ABI = [
  "function getCardNumbers(uint256 tokenId) view returns (uint8[25])",
  "function getCardBackground(uint256 tokenId) view returns (uint8)",
];

function getContract() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

export type CardOnchainData = {
  numbers: number[];      // 25 numbers (0 = free space)
  backgroundId: number;   // which background to use
};

/**
 * Fetches the bingo card data for a given tokenId from the blockchain.
 * This mirrors your original image-generator/fetchOnchain.js logic.
 */
export async function getCardData(tokenId: number): Promise<CardOnchainData> {
  try {
    const contract = getContract();

    const [numbers, background] = await Promise.all([
      contract.getCardNumbers(tokenId),
      contract.getCardBackground(tokenId),
    ]);

    // Ensure we have a plain JS array of numbers
    const nums = Array.from(numbers as number[]).map((n) => Number(n));

    return {
      numbers: nums,
      backgroundId: Number(background),
    };
  } catch (e) {
    console.error("❌ Error fetching on-chain data for token", tokenId, e);
    throw e;
  }
}
