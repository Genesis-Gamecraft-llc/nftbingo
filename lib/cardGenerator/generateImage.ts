// lib/cardGenerator/generateImage.ts
import fs from "fs";
import path from "path";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

let fontRegistered = false;

function ensureFontRegistered() {
  if (fontRegistered) return;

  const fontPath = path.join(process.cwd(), "public", "fonts", "NFTBingoNumbers.ttf");
  try {
    if (fs.existsSync(fontPath)) {
      GlobalFonts.registerFromPath(fontPath, "NFTBingoNumbers");
      // keep your existing console output behavior
      console.log(`✅ Registered canvas font "NFTBingoNumbers" from ${fontPath}`);
    } else {
      console.log(`⚠️ Font not found at ${fontPath} (continuing with default font).`);
    }
  } catch (e: any) {
    console.log("⚠️ Font register failed (continuing):", e?.message ?? e);
  }

  fontRegistered = true;
}

/**
 * Generates a bingo card image with numbers over a background.
 *
 * Backwards compatible:
 * - Founders/Series calls: generateCardImage(numbers, bgId)
 *
 * New:
 * - VIP calls: generateCardImage(numbers, bgId, "vip")
 */
export async function generateCardImage(
  numbers: number[],
  bgId: number,
  folder: "series1" | "vip" = "series1"
): Promise<Buffer> {
  ensureFontRegistered();

  // Safety
  if (!Array.isArray(numbers) || numbers.length !== 25) {
    throw new Error(`generateCardImage(): expected numbers length 25, got ${numbers?.length}`);
  }

  // Background path (VIP is its own folder)
  const backgroundsDir = path.join(process.cwd(), "public", "backgrounds", folder);
  const primaryBgPath = path.join(backgroundsDir, `bg${bgId}.png`);
  const fallbackBgPath = path.join(backgroundsDir, `bg0.png`);

  const bgPath = fs.existsSync(primaryBgPath) ? primaryBgPath : fallbackBgPath;

  if (!fs.existsSync(bgPath)) {
    throw new Error(
      `Missing background. Tried:\n- ${primaryBgPath}\n- ${fallbackBgPath}\nFolder: ${folder}`
    );
  }

  const img = await loadImage(bgPath);

  // Use the background size as canvas size
  const width = img.width;
  const height = img.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Draw background
  ctx.drawImage(img, 0, 0, width, height);

  // ---- Number rendering ----
  // These values assume your template (grid area) matches what you already had working.
  // If your layout shifts, tweak these 4 numbers only.
  const gridLeft = Math.round(width * 0.06);
  const gridTop = Math.round(height * 0.36);
  const gridWidth = Math.round(width * 0.88);
  const gridHeight = Math.round(height * 0.58);

  const cellW = gridWidth / 5;
  const cellH = gridHeight / 5;

  // Font setup
  const fontSize = Math.round(Math.min(cellW, cellH) * 0.42);
  ctx.font = `${fontSize}px NFTBingoNumbers, Arial, sans-serif`;
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Slight shadow for readability
  ctx.shadowColor = "rgba(0,0,0,0.15)";
  ctx.shadowBlur = Math.round(fontSize * 0.08);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.round(fontSize * 0.05);

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const idx = r * 5 + c;
      const value = numbers[idx];

      // FREE is usually encoded as 0 in your system
      const label = value === 0 ? "FREE" : String(value);

      const x = gridLeft + c * cellW + cellW / 2;
      const y = gridTop + r * cellH + cellH / 2;

      ctx.fillText(label, x, y);
    }
  }

  return canvas.toBuffer("image/png");
}
