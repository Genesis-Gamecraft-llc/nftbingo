// lib/cardGenerator/config.ts

// ---- CARD IMAGE SIZE ----
export const CARD_W = 2048;
export const CARD_H = 3072;

// ---- GRID LOCATION (from Photoshop rulers) ----
export const GRID_X = 72;    // Left edge of grid
export const GRID_Y = 1394;  // Top edge of grid
export const GRID_W = 1900;  // Total grid width
export const GRID_H = 1600;  // Total grid height

// ---- INDIVIDUAL CELL SIZE (5x5) ----
// You can leave these as formulas or hard-code 380 / 320.
export const CELL_W = GRID_W / 5; // 380
export const CELL_H = GRID_H / 5; // 320

// ---- GRID DIMENSIONS ----
export const GRID_ROWS = 5;
export const GRID_COLS = 5;

// ---- RPC + CONTRACT (from env) ----
export const RPC_URL = process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL!;
export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFTBINGO_CONTRACT_ADDRESS!;
