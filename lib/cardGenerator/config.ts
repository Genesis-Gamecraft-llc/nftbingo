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

export const RPC_URL =
  process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL ??
  "https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY_HERE";

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFTBINGO_CONTRACT_ADDRESS ??
  "0xA5bfD2ee0413EbC7c89d1fCC9BB468daAD6CD1d2";
