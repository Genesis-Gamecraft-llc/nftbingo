// lib/cardGenerator/generateImage.ts

import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  CARD_W,
  CARD_H,
  GRID_X,
  GRID_Y,
  CELL_W,
  CELL_H,
} from "./config";
import path from "path";

/**
 * Generate a bingo card image as a PNG buffer.
 *
 * - Uses background PNGs from /public/backgrounds/series1/bg{backgroundId}.png
 * - If that specific background is missing, falls back to bg0.png
 * - Draws a 5x5 grid of numbers
 * - Does NOT draw anything where the number is 0 (so the background logo shows through)
 */
export async function generateCardImage(
  numbers: number[],
  backgroundId: number
): Promise<Buffer> {
  // Create canvas & context
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext("2d");

  // ---- Load background ----
  const backgroundsDir = path.join(process.cwd(), "public", "backgrounds");
  const specificBgPath = path.join(
    backgroundsDir,
    "series1",
    `bg${backgroundId}.png`
  );
  const fallbackBgPath = path.join(backgroundsDir, "series1", "bg0.png");

  let backgroundImg;
  try {
    backgroundImg = await loadImage(specificBgPath);
  } catch (err) {
    console.warn(
      `⚠️ Background bg${backgroundId}.png not found, falling back to bg0.png`
    );
    backgroundImg = await loadImage(fallbackBgPath);
  }

  // Draw background to full canvas
  ctx.drawImage(backgroundImg, 0, 0, CARD_W, CARD_H);

  // ---- Draw Numbers Grid ----
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Use the standard font (no custom font registration)
  ctx.font = "bold 140px sans-serif";
  ctx.fillStyle = "#000000";

  // Convert numbers into 5×5 grid
  const grid: number[][] = [];
  for (let i = 0; i < 5; i++) {
    grid.push(numbers.slice(i * 5, i * 5 + 5));
  }

  // Draw each number cell
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const number = grid[row][col];

      // If number is 0, we treat it as a FREE/center space and draw nothing,
      // letting the background (with the logo) show through.
      if (number === 0) continue;

      const x = GRID_X + col * CELL_W + CELL_W / 2;
      const y = GRID_Y + row * CELL_H + CELL_H / 2;

      ctx.fillText(number.toString(), x, y);
    }
  }

  // ---- Return PNG Buffer ----
  return canvas.toBuffer("image/png");
}
