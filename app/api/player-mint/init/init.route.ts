import "server-only";

import crypto from "crypto";
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InitRequest = {
  wallet: string; // base58
  count: number;  // locked to 1
};

type PlayerInitRecord = {
  buildId: string;
  wallet: string;
  createdAt: number;
  expiresAt: number;
  count: number;
  items: Array<{
    index: number;
    serialNum: number;   // 1..∞
    serialStr: string;   // "0001"
    backgroundId: number;
    numbers: number[];   // 25 row-major, center index 12 = 0 (FREE)
  }>;
};

function buildKey(buildId: string) {
  return `player:build:${buildId}`;
}

function playerSerialKey() {
  // Counter starts from 0 in KV; first incr => 1
  return `player:serial`;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashToSeed(s: string): number {
  const h = crypto.createHash("sha256").update(s).digest();
  return h.readUInt32LE(0);
}

function shuffle<T>(arr: T[], rnd: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function generateBingoNumbers(seedStr: string): number[] {
  const seed = hashToSeed(seedStr);
  const rnd = mulberry32(seed);

  const ranges: Array<[number, number]> = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75],
  ];

  const cols: number[][] = [];
  for (let c = 0; c < 5; c++) {
    const [a, b] = ranges[c];
    const pool = Array.from({ length: b - a + 1 }, (_, i) => a + i);
    shuffle(pool, rnd);
    cols[c] = pool.slice(0, 5);
  }

  const grid: number[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      grid.push(cols[c][r]);
    }
  }

  grid[12] = 0; // FREE
  return grid;
}

function formatSerial4(n: number) {
  return String(n).padStart(4, "0"); // 0001
}

function getBackgroundId(): number {
  const raw = process.env.PLAYER_SERIES_BACKGROUND_ID?.trim();
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as InitRequest;

    const wallet = String(body.wallet || "").trim();

    // ✅ HARD LOCK: only allow 1 per mint (reject anything else)
    const requested = Number(body.count || 1);
    if (requested !== 1) {
      return NextResponse.json(
        { ok: false, error: "Player Series mint is limited to 1 card per mint (for reliability)." },
        { status: 400 }
      );
    }

    if (!wallet) {
      return NextResponse.json({ ok: false, error: "Missing wallet" }, { status: 400 });
    }

    // light rate-limit to reduce spam (init only)
    const rlKey = `player:init:rl:${wallet}`;
    const ok = await kv.set(rlKey, Date.now(), { nx: true, ex: 3 });
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Slow down" }, { status: 429 });
    }

    const buildId = crypto.randomUUID();
    const backgroundId = getBackgroundId(); // bg0.png

    // Allocate serial now (stable)
    const serialNum = Number(await kv.incr(playerSerialKey())); // 1..∞
    const serialStr = formatSerial4(serialNum);

    const numbers = generateBingoNumbers(`player:${buildId}:${wallet}:${serialNum}:0`);

    const record: PlayerInitRecord = {
      buildId,
      wallet,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000,
      count: 1,
      items: [{ index: 0, serialNum, serialStr, backgroundId, numbers }],
    };

    await kv.set(buildKey(buildId), record, { ex: 10 * 60 });

    // NOTE: We no longer return PNG/metadata templates to the client.
    // Server pays for Irys uploads during /api/player-mint/build.
    return NextResponse.json({
      ok: true,
      buildId,
      count: 1,
      backgroundId,
      packages: [{ index: 0, serialNum, serialStr, backgroundId }],
      note:
        "Server will generate PNG + metadata and pay Irys upload fees. Client will only sign the mint transaction (Solana fees).",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Init error" }, { status: 500 });
  }
}
