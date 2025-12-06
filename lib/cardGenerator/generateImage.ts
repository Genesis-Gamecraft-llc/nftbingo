// lib/cardGenerator/generateImage.ts
import path from "path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  CARD_W,
  CARD_H,
  GRID_X,
  GRID_Y,
  GRID_W,
  GRID_H,
  CELL_W,
  CELL_H,
} from "./config";

/**
 * Render a full NFTBingo card image as a PNG buffer.
 *
 * - `numbers` is a flat array of 25 ints from the contract (row-major: 5 rows of 5).
 * - `backgroundId` selects /public/backgrounds/series1/bg{backgroundId}.png
 *   and falls back to bg0.png if that file doesn’t exist.
 */
export async function generateCardImage(
  numbers: number[],
  backgroundId: number
): Promise<Buffer> {
  // Sanity check so we don’t silently draw garbage
  if (!Array.isArray(numbers) || numbers.length !== 25) {
    throw new Error(`Expected 25 numbers, got ${numbers.length}`);
  }

  // 1) Canvas + context
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext("2d");

  // 2) Load background (Series 1)
  const backgroundsDir = path.join(
    process.cwd(),
    "public",
    "backgrounds",
    "series1"
  );

  const requestedPath = path.join(backgroundsDir, `bg${backgroundId}.png`);
  const fallbackPath = path.join(backgroundsDir, "bg0.png");

  let bgImage;
  try {
    bgImage = await loadImage(requestedPath);
  } catch {
    console.warn(
      `⚠️  Background bg${backgroundId}.png not found. Falling back to bg0.png`
    );
    bgImage = await loadImage(fallbackPath);
  }

  // Draw full-card background
  ctx.drawImage(bgImage, 0, 0, CARD_W, CARD_H);

  // 3) Draw numbers using the Photoshop grid measurements
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 150px sans-serif"; // matches the original generator
  ctx.fillStyle = "#000000";

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      // FREE center – logo lives there on the background
      if (row === 2 && col === 2) continue;

      const idx = row * 5 + col;
      const value = numbers[idx];

      // If the contract encodes FREE as 0, skip zero as well.
      if (value === 0) continue;

      const centerX = GRID_X + col * CELL_W + CELL_W / 2;
      const centerY = GRID_Y + row * CELL_H + CELL_H / 2;

      ctx.fillText(String(value), centerX, centerY);
    }
  }

  // 4) Return PNG buffer for the API route
  return canvas.toBuffer("image/png");
}