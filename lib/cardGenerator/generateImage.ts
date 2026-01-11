// lib/cardGenerator/generateImage.ts

import path from "path";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { CARD_W, CARD_H, GRID_X, GRID_Y, CELL_W, CELL_H } from "./config";

// ---- FONT SETUP ----
// Font file path: public/fonts/NFTBingoNumbers.ttf
const FONT_FAMILY = "NFTBingoNumbers";

// Register font once (works on Vercel + local)
(() => {
  try {
    const fontPath = path.join(process.cwd(), "public", "fonts", "NFTBingoNumbers.ttf");
    if (!GlobalFonts.has(FONT_FAMILY)) {
      const ok = GlobalFonts.registerFromPath(fontPath, FONT_FAMILY);
      if (ok) {
        console.log(`✅ Registered canvas font "${FONT_FAMILY}" from ${fontPath}`);
      } else {
        console.warn(`⚠️ Failed to register font at ${fontPath} for family ${FONT_FAMILY}`);
      }
    }
  } catch (err) {
    console.warn("⚠️ Error registering canvas font:", err);
  }
})();

export type SeriesFolder = "series1" | "vip" | (string & {});
export type GenerateCardImageOptions = {
  /**
   * Which folder under /public/backgrounds/ to use.
   * - Founders: "series1"
   * - VIP: "vip"
   */
  seriesFolder?: SeriesFolder;

  /**
   * Optional override for number styling.
   * Defaults match your prior working look.
   */
  fontSizePx?: number;
  fontColor?: string;
  fontWeight?: string; // e.g. "bold"
};

/**
 * Generate a bingo card PNG buffer.
 *
 * - numbers: 25 values (row-major 5x5)
 * - backgroundId: which bgX.png
 * - options.seriesFolder: "series1" (default) or "vip"
 *
 * IMPORTANT:
 * - We DO NOT draw anything in the center cell (idx 12).
 *   Your background already contains the FREE/logo spot.
 */
export async function generateCardImage(
  numbers: number[],
  backgroundId: number,
  options?: GenerateCardImageOptions
): Promise<Buffer> {
  if (!Array.isArray(numbers) || numbers.length !== 25) {
    throw new Error(`Expected 25 numbers, got ${Array.isArray(numbers) ? numbers.length : "non-array"}`);
  }

  const seriesFolder: SeriesFolder = options?.seriesFolder ?? "series1";
  const fontSizePx = options?.fontSizePx ?? 150;
  const fontColor = options?.fontColor ?? "#000000";
  const fontWeight = options?.fontWeight ?? "bold";

  // 1) Create canvas & context
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext("2d");

  // 2) Draw background
  const backgroundsDir = path.join(process.cwd(), "public", "backgrounds", String(seriesFolder));
  const requestedBg = path.join(backgroundsDir, `bg${backgroundId}.png`);
  const fallbackBg = path.join(backgroundsDir, "bg0.png");

  let bgImage;
  try {
    bgImage = await loadImage(requestedBg);
  } catch {
    // Fallback for missing bg files
    bgImage = await loadImage(fallbackBg);
  }

  ctx.drawImage(bgImage, 0, 0, CARD_W, CARD_H);

  // 3) Text styling
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fontColor;
  ctx.font = `${fontWeight} ${fontSizePx}px ${FONT_FAMILY}`;

  // 4) Draw 5x5 numbers using your config-based grid math
  // Skip the center (idx 12). Do NOT print FREE text.
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;
      if (idx === 12) continue; // center cell

      const value = numbers[idx];
      if (!Number.isFinite(value) || value <= 0) continue;

      const x = GRID_X + col * CELL_W + CELL_W / 2;
      const y = GRID_Y + row * CELL_H + CELL_H / 2;

      ctx.fillText(String(value), x, y);
    }
  }

  return canvas.toBuffer("image/png");
}
