// lib/cardGenerator/generateImage.ts

import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import path from "path";
import {
  CARD_W,
  CARD_H,
  GRID_X,
  GRID_Y,
  CELL_W,
  CELL_H,
} from "./config";

// ---- FONT SETUP ----
// 1) Put your TTF at: public/fonts/NFTBingoNumbers.ttf
// 2) This alias must match what we use in ctx.font:
const FONT_FAMILY = "NFTBingoNumbers";

// Register the font once at module load so both localhost and Vercel
// have a known font to render with.
(() => {
  try {
    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "NFTBingoNumbers.ttf"
    );

    // Only register if not already present
    if (!GlobalFonts.has(FONT_FAMILY)) {
      const ok = GlobalFonts.registerFromPath(fontPath, FONT_FAMILY);
      if (!ok) {
        console.warn(
          `⚠️ Failed to register font at ${fontPath} for family ${FONT_FAMILY}`
        );
      } else {
        console.log(
          `✅ Registered canvas font "${FONT_FAMILY}" from ${fontPath}`
        );
      }
    }
  } catch (err) {
    console.warn("⚠️ Error registering canvas font:", err);
  }
})();

/**
 * Generate a bingo card image as a PNG buffer.
 *
 * - numbers: 25 values from the contract (row-major 5x5)
 * - backgroundId: which bgX.png to use from /public/backgrounds/series1
 *   (falls back to bg0.png if that file doesn’t exist)
 */
export async function generateCardImage(
  numbers: number[],
  backgroundId: number
): Promise<Buffer> {
  if (!Array.isArray(numbers) || numbers.length !== 25) {
    throw new Error(`Expected 25 numbers, got ${numbers.length}`);
  }

  // 1) Create canvas & context
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext("2d");

  // 2) Draw background
  const backgroundsDir = path.join(
    process.cwd(),
    "public",
    "backgrounds",
    "series1"
  );

  const requestedBg = path.join(backgroundsDir, `bg${backgroundId}.png`);
  const fallbackBg = path.join(backgroundsDir, "bg0.png");

  let bgImage;
  try {
    bgImage = await loadImage(requestedBg);
  } catch {
    console.warn(
      `⚠️ Background bg${backgroundId}.png not found. Falling back to bg0.png`
    );
    bgImage = await loadImage(fallbackBg);
  }

  ctx.drawImage(bgImage, 0, 0, CARD_W, CARD_H);

  // 3) Text styling
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000000";
  // Use the registered font family so it works on Vercel
  ctx.font = `bold 150px ${FONT_FAMILY}`;

  // 4) Draw 5x5 numbers (skip center FREE)
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;
      const value = numbers[idx];

      // Skip center cell (index 12) so FREE/logo shows
      if (idx === 12) continue;

      // If contract encodes FREE as 0, also skip zeros just in case
      if (!Number.isFinite(value) || value <= 0) continue;

      const x = GRID_X + col * CELL_W + CELL_W / 2;
      const y = GRID_Y + row * CELL_H + CELL_H / 2;

      ctx.fillText(String(value), x, y);
    }
  }

  // 5) Return PNG buffer
  return canvas.toBuffer("image/png");
}
