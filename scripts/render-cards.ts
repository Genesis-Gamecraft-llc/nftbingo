import path from "node:path";
import fs from "node:fs";
import { generateCardImage } from "../lib/cardGenerator/generateImage"; // <-- adjust if needed

type Series = "founders" | "vip";

function arg(flag: string) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function parseBgList(input: string): number[] {
  // supports "0,1,2" or "0-49" or "0-10,12,14-16"
  const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
  const out: number[] = [];

  for (const p of parts) {
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(p);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      for (let i = start; i <= end; i++) out.push(i);
    } else if (/^\d+$/.test(p)) {
      out.push(Number(p));
    } else {
      throw new Error(`Invalid --bgs token: "${p}" (use e.g. 0,1,2 or 0-49)`);
    }
  }

  // de-dupe, keep order
  const seen = new Set<number>();
  return out.filter((n) => (seen.has(n) ? false : (seen.add(n), true)));
}

// Standard bingo rules: B 1–15, I 16–30, N 31–45 (center free), G 46–60, O 61–75
function sampleUnique(min: number, max: number, count: number) {
  const pool: number[] = [];
  for (let i = min; i <= max; i++) pool.push(i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function generateBingoNumbersRowMajor25(): number[] {
  const B = sampleUnique(1, 15, 5);
  const I = sampleUnique(16, 30, 5);
  const N = sampleUnique(31, 45, 5);
  const G = sampleUnique(46, 60, 5);
  const O = sampleUnique(61, 75, 5);

  // Center FREE placeholder: encoded as 0 (and should NOT be drawn)
  N[2] = 0;

  const grid: number[][] = [
    [B[0], I[0], N[0], G[0], O[0]],
    [B[1], I[1], N[1], G[1], O[1]],
    [B[2], I[2], N[2], G[2], O[2]],
    [B[3], I[3], N[3], G[3], O[3]],
    [B[4], I[4], N[4], G[4], O[4]],
  ];

  const flat: number[] = [];
  for (const row of grid) for (const v of row) flat.push(v);
  return flat;
}

async function main() {
  const series = ((arg("--series") ?? "founders") as Series);
  const bgsArg = arg("--bgs"); // "0,1,2" or "0-49"
  const count = Number(arg("--count") ?? "1"); // images per background
  const outRoot = arg("--out") ?? path.join(process.cwd(), "out", "promos");

  if (!bgsArg) {
    throw new Error(`Missing --bgs. Example: --bgs 0-49 or --bgs 0,3,7`);
  }

  const bgIds = parseBgList(bgsArg);
  const outDir = path.join(outRoot, series);
  ensureDir(outDir);

  console.log(`Series: ${series}`);
  console.log(`Backgrounds: ${bgIds.join(", ")}`);
  console.log(`Count per background: ${count}`);
  console.log(`Output: ${outDir}\n`);

  for (const bgId of bgIds) {
    for (let i = 1; i <= count; i++) {
      const numbers = generateBingoNumbersRowMajor25();

      // NOTE: generateCardImage must support { series } and must not draw center 0
      const png = await generateCardImage(numbers, bgId, { seriesFolder: series });


      const fileName =
        `${series}-bg${String(bgId).padStart(2, "0")}` +
        (count > 1 ? `-ex${String(i).padStart(2, "0")}` : "") +
        `.png`;

      const outPath = path.join(outDir, fileName);
      fs.writeFileSync(outPath, Buffer.from(png));
      console.log(`✅ wrote ${fileName}`);
    }
  }

  console.log(`\nDone. Folder:\n${outDir}`);
}

main().catch((e) => {
  console.error("❌ render failed:", e?.message ?? e);
  process.exit(1);
});
