// lib/mint/slots.server.ts
import "server-only";

import crypto from "crypto";
import { kv } from "@vercel/kv";

export type SlotRecord = {
  slotId: number;          // 1..100
  wallet: string;          // reserving wallet
  backgroundId: number;    // 1..50 (two of each overall)
  reservedAt: number;      // ms
  expiresAt: number;       // ms
};

const KEY_NEXT = "founders:nextSlot";                 // number
const KEY_LOCK = "founders:activeReservation";        // SlotRecord
const KEY_BG_POOL = "founders:bgPool";                // number[] remaining
const KEY_MINTED_PREFIX = "founders:minted:";         // + slotId => { mint, wallet, ts, bg }
const TOTAL_SLOTS = 100;
const BACKGROUND_COUNT = 50;                          // 2 each => 100 total
const RESERVATION_MS = 5 * 60 * 1000;                 // 5 minutes

function now() {
  return Date.now();
}

function shuffle<T>(arr: T[]) {
  // Fisher-Yates using crypto randomness
  for (let i = arr.length - 1; i > 0; i--) {
    const r = crypto.randomBytes(4).readUInt32LE(0);
    const j = r % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function ensureInitialized() {
  const next = await kv.get<number>(KEY_NEXT);
  if (typeof next === "number") return;

  // Initialize next slot
  await kv.set(KEY_NEXT, 1);

  // Initialize background pool: [1..50] twice each, shuffled
  const pool: number[] = [];
  for (let i = 1; i <= BACKGROUND_COUNT; i++) {
    pool.push(i, i);
  }
  shuffle(pool);
  await kv.set(KEY_BG_POOL, pool);

  // Clear any stale lock
  await kv.del(KEY_LOCK);
}

async function readActiveLock(): Promise<SlotRecord | null> {
  const lock = await kv.get<SlotRecord>(KEY_LOCK);
  if (!lock) return null;

  // If expired, clear it and return null
  if (lock.expiresAt <= now()) {
    // Put background back if it was reserved and not minted.
    const pool = (await kv.get<number[]>(KEY_BG_POOL)) ?? [];
    pool.push(lock.backgroundId);
    shuffle(pool);
    await kv.set(KEY_BG_POOL, pool);
    await kv.del(KEY_LOCK);
    return null;
  }

  return lock;
}

export async function reserveSlot(wallet: string): Promise<SlotRecord> {
  await ensureInitialized();

  // If there is an active reservation, only the SAME wallet can reuse it.
  const active = await readActiveLock();
  if (active) {
    if (active.wallet === wallet) return active;
    throw new Error("SLOT_RESERVED");
  }

  const next = (await kv.get<number>(KEY_NEXT)) ?? 1;
  if (next > TOTAL_SLOTS) throw new Error("SOLD_OUT");

  // Safety: if already minted, advance until we find an unminted slot (shouldn’t happen, but protects against manual KV edits)
  let slotId = next;
  while (slotId <= TOTAL_SLOTS) {
    const minted = await kv.get(`${KEY_MINTED_PREFIX}${slotId}`);
    if (!minted) break;
    slotId++;
  }
  if (slotId > TOTAL_SLOTS) throw new Error("SOLD_OUT");

  // Pull one background from the pool
  const pool = (await kv.get<number[]>(KEY_BG_POOL)) ?? [];
  if (pool.length === 0) throw new Error("BG_POOL_EMPTY");
  const backgroundId = pool.pop()!;
  await kv.set(KEY_BG_POOL, pool);

  const t = now();
  const rec: SlotRecord = {
    slotId,
    wallet,
    backgroundId,
    reservedAt: t,
    expiresAt: t + RESERVATION_MS,
  };

  await kv.set(KEY_LOCK, rec);
  return rec;
}

// Release ONLY if the active reservation matches.
// This is what makes 001 come back if it wasn’t minted.
export async function releaseSlot(wallet: string, slotId: number): Promise<void> {
  await ensureInitialized();

  const active = await kv.get<SlotRecord>(KEY_LOCK);
  if (!active) return;
  if (active.wallet !== wallet) return;
  if (active.slotId !== slotId) return;

  // Return background back to the pool
  const pool = (await kv.get<number[]>(KEY_BG_POOL)) ?? [];
  pool.push(active.backgroundId);
  shuffle(pool);
  await kv.set(KEY_BG_POOL, pool);

  await kv.del(KEY_LOCK);
}

// Mark minted advances the pointer to the next slot (slotId+1).
export async function markSlotMinted(wallet: string, slotId: number, mint: string): Promise<void> {
  await ensureInitialized();

  const active = await kv.get<SlotRecord>(KEY_LOCK);
  if (!active) throw new Error("NO_ACTIVE_RESERVATION");
  if (active.wallet !== wallet) throw new Error("RESERVATION_WALLET_MISMATCH");
  if (active.slotId !== slotId) throw new Error("RESERVATION_SLOT_MISMATCH");
  if (active.expiresAt <= now()) throw new Error("RESERVATION_EXPIRED");

  // Persist minted record
  await kv.set(`${KEY_MINTED_PREFIX}${slotId}`, {
    mint,
    wallet,
    backgroundId: active.backgroundId,
    ts: now(),
  });

  // Clear lock and advance pointer
  await kv.del(KEY_LOCK);
  await kv.set(KEY_NEXT, slotId + 1);
}
