// lib/cardGenerator/config.ts

// ---- CARD IMAGE SIZE ----
export const CARD_W = 2048;
export const CARD_H = 3072;

// ---- GRID LOCATION (from Photoshop rulers) ----
export const GRID_X = 72; // Left edge of grid
export const GRID_Y = 1394; // Top edge of grid
export const GRID_W = 1900; // Total width of numbers grid
export const GRID_H = 1600; // Total height of numbers grid

// ---- INDIVIDUAL CELL SIZE (5x5) ----
export const CELL_W = 380; // 1900 / 5
export const CELL_H = 320; // 1600 / 5

// ---- BLOCKCHAIN CONNECTION ----
// We will read these from environment variables in Next.js
// instead of hard-coding secrets into the repo.

// ---- Env-configured RPC + Contract ----

const rpcUrl = process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL;
const contractAddr = process.env.NEXT_PUBLIC_NFTBINGO_CONTRACT_ADDRESS;

if (!rpcUrl) {
  throw new Error(
    "❌ Missing NEXT_PUBLIC_POLYGON_AMOY_RPC_URL. Define it in .env.local AND in Vercel Project Settings."
  );
}

if (!contractAddr) {
  throw new Error(
    "❌ Missing NEXT_PUBLIC_NFTBINGO_CONTRACT_ADDRESS. Define it in .env.local AND in Vercel Project Settings."
  );
}

// Export as definite strings so TypeScript is happy
export const RPC_URL: string = rpcUrl;
export const CONTRACT_ADDRESS: string = contractAddr;

