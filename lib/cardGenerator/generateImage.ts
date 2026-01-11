// lib/cardGenerator/generateImage.ts

import fs from "fs";
import path from "path";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

import { CARD_W, CARD_H, GRID_X, GRID_Y, CELL_W, CELL_H } from "./config";

export type SeriesFolder = "series1" | "vip" | string;

export type GenerateCardImageOptions = {
  /**
   * Which folder under /public/backgrounds/ to use.
   * Examples: "series1" (Founders), "vip" (VIP)
   */
  seriesFolder?: SeriesFolder;

  /**
   * Optional explicit background path (relative to /public or absolute).
   * Example (relative to /public): "backgrounds/vip/bg0.png"
   */
  backgroundPath?: string;

  /**
   * Optional number styling overrides (leave blank to use defaults).
   */
  numberFontSizePx?: number;
  numberColor?: string;
};

let fontRegistered = false;

function ensureFontRegistered() {
  if (fontRegistered) return;

  const fontPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "NFTBingoNumbers.ttf"
  );

  if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, "NFTBingoNumbers");
    console.log(`✅ Registered canvas font "NFTBingoNumbers" from ${fontPath}`);
  } else {
    console.log(
      `⚠️ Font not found at ${fontPath} (continuing with default font)`
    );
  }

  fontRegistered = true;
}

function safeJoinPublic(relPathFromPublic: string) {
  const parts = relPathFromPublic.split(/[\\/]/g).filter(Boolean);
  return path.join(process.cwd(), "public", ...parts);
}

/**
 * Generate a Bingo card PNG buffer.
 * - numbers must be length 25
 * - we SKIP the center index 12 draw (center artwork is part of the background)
 */
export async function generateCardImage(
  numbers: number[],
  backgroundId: number,
  options?: GenerateCardImageOptions
): Promise<Buffer> {
  ensureFontRegistered();

  if (!Array.isArray(numbers) || numbers.length !== 25) {
    throw new Error(`Expected 25 numbers, got ${numbers?.length ?? 0}`);
  }

  // Defaults (so we don't depend on config exports that may not exist)
  const fontSize =
    options?.numberFontSizePx ??
    Math.max(22, Math.floor(Math.min(CELL_W, CELL_H) * 0.55));
  const fontColor = options?.numberColor ?? "#111";

  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext("2d");

  // Background resolution
  const seriesFolder = (options?.seriesFolder || "series1").trim();

  const explicitBg = options?.backgroundPath
    ? path.isAbsolute(options.backgroundPath)
      ? options.backgroundPath
      : safeJoinPublic(options.backgroundPath)
    : null;

  const backgroundsDir = path.join(
    process.cwd(),
    "public",
    "backgrounds",
    seriesFolder
  );

  const requestedBg =
    explicitBg ?? path.join(backgroundsDir, `bg${backgroundId}.png`);

  const fallbackSeriesBg0 = path.join(backgroundsDir, "bg0.png");
  const fallbackFoundersBg0 = path.join(
    process.cwd(),
    "public",
    "backgrounds",
    "series1",
    "bg0.png"
  );

  let bgPathToUse: string | null = null;

  if (requestedBg && fs.existsSync(requestedBg)) bgPathToUse = requestedBg;
  else if (fs.existsSync(fallbackSeriesBg0)) bgPathToUse = fallbackSeriesBg0;
  else if (fs.existsSync(fallbackFoundersBg0)) bgPathToUse = fallbackFoundersBg0;

  if (bgPathToUse) {
    const bg = await loadImage(bgPathToUse);
    ctx.drawImage(bg, 0, 0, CARD_W, CARD_H);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }

  // Draw numbers
  ctx.fillStyle = fontColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${fontSize}px "NFTBingoNumbers"`;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;

      // DO NOT draw the center (background handles the free/logo spot)
      if (idx === 12) continue;

      const value = numbers[idx];
      if (value === undefined || value === null) continue;

      const x = GRID_X + col * CELL_W + CELL_W / 2;
      const y = GRID_Y + row * CELL_H + CELL_H / 2;

      ctx.fillText(String(value), x, y);
    }
  }

  return canvas.toBuffer("image/png");
}
