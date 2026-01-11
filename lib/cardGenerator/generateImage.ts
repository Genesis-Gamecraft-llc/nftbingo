// lib/cardGenerator/generateImage.ts
/**
 * Server-side bingo card image generator.
 *
 * Supports:
 *  - Founders / Series1 backgrounds: /public/backgrounds/series1/bg{bgId}.png
 *  - VIP backgrounds:               /public/backgrounds/vip/bg{bgId}.png
 *
 * IMPORTANT:
 *  - We DO NOT render anything in the center square. The "FREE" + logo is part of the background art.
 *  - Numbers must be a 25-length array in row-major order. Center index 12 is ignored.
 */

import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

import { CARD_W, CARD_H, GRID_X, GRID_Y, CELL_W, CELL_H } from "./config";

export type SeriesFolder = "series1" | "vip" | (string & {});
export type GenerateCardImageOptions = {
  /**
   * Which folder under /public/backgrounds/ to use.
   * Defaults to "series1" (Founders).
   */
  seriesFolder?: SeriesFolder;

  /**
   * Override the font path (defaults to /public/fonts/NFTBingoNumbers.ttf)
   */
  fontPath?: string;

  /**
   * Font family name to use when drawing numbers.
   * Defaults to "NFTBingoNumbers"
   */
  fontFamily?: string;

  /**
   * Font size in px (defaults to a value that matches 2048x3072 art).
   */
  fontSizePx?: number;
};

let fontReady = false;

function ensureFontRegistered(opts?: GenerateCardImageOptions) {
  if (fontReady) return;

  const fontPath =
    opts?.fontPath ??
    path.join(process.cwd(), "public", "fonts", "NFTBingoNumbers.ttf");

  const family = opts?.fontFamily ?? "NFTBingoNumbers";

  try {
    if (fs.existsSync(fontPath)) {
      GlobalFonts.registerFromPath(fontPath, family);
      console.log(`✅ Registered canvas font "${family}" from ${fontPath}`);
    } else {
      console.log(`⚠️ Font not found at ${fontPath} (using default system font)`);
    }
  } catch (e: any) {
    console.log("⚠️ Font register failed (using default system font):", e?.message ?? e);
  }

  fontReady = true;
}

function resolveBackgroundPath(bgId: number, seriesFolder: string) {
  return path.join(
    process.cwd(),
    "public",
    "backgrounds",
    seriesFolder,
    `bg${bgId}.png`
  );
}

/**
 * Primary API.
 * Backwards compatible with older callers that did: generateCardImage(numbers, bgId)
 */
export async function generateCardImage(
  numbers: number[],
  bgId: number,
  options?: GenerateCardImageOptions
): Promise<Buffer> {
  ensureFontRegistered(options);

  if (!Array.isArray(numbers) || numbers.length !== 25) {
    throw new Error(
      `Missing card numbers. Expected a 25-number array, got ${
        Array.isArray(numbers) ? numbers.length : typeof numbers
      }.`
    );
  }

  const seriesFolder = options?.seriesFolder ?? "series1";
  const bgPath = resolveBackgroundPath(bgId, seriesFolder);

  if (!fs.existsSync(bgPath)) {
    throw new Error(`Background not found: ${bgPath}`);
  }

  const bg = await loadImage(bgPath);

  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext("2d");

  // Draw background full size
  ctx.drawImage(bg, 0, 0, CARD_W, CARD_H);

  const family = options?.fontFamily ?? "NFTBingoNumbers";
  const fontSize = options?.fontSizePx ?? 156;

  // Text styling
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000"; // black numbers
  ctx.font = `${fontSize}px "${family}"`;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;

      // Center (FREE) square: DO NOT render anything
      if (idx === 12) continue;

      const n = numbers[idx];
      if (n === null || n === undefined || Number.isNaN(Number(n))) continue;

      const x = GRID_X + col * CELL_W + CELL_W / 2;
      const y = GRID_Y + row * CELL_H + CELL_H / 2;

      ctx.fillText(String(n), x, y);
    }
  }

  return canvas.toBuffer("image/png");
}

/**
 * Compatibility alias (older code imported { generateImage }).
 */
export const generateImage = generateCardImage;
