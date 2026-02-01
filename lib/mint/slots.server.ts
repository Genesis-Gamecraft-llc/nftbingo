// lib/mint/slots.server.ts
import "server-only";
import { kv } from "@vercel/kv";

export type SlotRecord = {
  slotId: number;            // 1..100 (serial)
  backgroundId: number;      // 0..49
  reservedBy: string;        // wallet pubkey (base58)
  reservedAt: number;        // ms
  expiresAt: number;         // ms
};

const TOTAL_SLOTS = 100;
const BACKGROUND_COUNT = 50; // bg0..bg49 only

const RESERVATION_TTL_SECONDS = 300; // 5 minutes
const RESERVATION_TTL_MS = RESERVATION_TTL_SECONDS * 1000;

// Pool: 0..49, two copies each => 100
const BG_POOL_KEY = "founders:bgPool";
const NEXT_HINT_KEY = "founders:nextHint";

function reservationKey(slotId: number) {
  return `founders:slot:${slotId}:reservation`;
}
function mintedKey(slotId: number) {
  return `founders:slot:${slotId}:minted`;
}
function walletKey(wallet: string) {
  return `founders:wallet:${wallet}:slot`;
}

function isValidPool(pool: unknown): pool is number[] {
  if (!Array.isArray(pool)) return false;
  if (pool.length !== TOTAL_SLOTS) return false;
  for (const n of pool) {
    if (!Number.isInteger(n)) return false;
    if (n < 0 || n >= BACKGROUND_COUNT) return false;
  }
  return true;
}

function buildFreshPool(): number[] {
  const pool: number[] = [];
  for (let bg = 0; bg < BACKGROUND_COUNT; bg++) {
    pool.push(bg, bg);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

async function ensureInitialized() {
  const existing = await kv.get<number[]>(BG_POOL_KEY);
  if (isValidPool(existing)) {
    const hint = await kv.get<number>(NEXT_HINT_KEY);
    if (!hint) await kv.set(NEXT_HINT_KEY, 1);
    return;
  }
  const pool = buildFreshPool();
  await kv.set(BG_POOL_KEY, pool);
  await kv.set(NEXT_HINT_KEY, 1);
}

async function popBackgroundId(): Promise<number> {
  await ensureInitialized();

  const pool = (await kv.get<number[]>(BG_POOL_KEY)) || [];
  if (pool.length === 0) throw new Error("SOLD_OUT");

  const bg = pool.shift();

  if (typeof bg !== "number" || !Number.isInteger(bg) || bg < 0 || bg >= BACKGROUND_COUNT) {
    // Self-heal corrupted pool
    await kv.set(BG_POOL_KEY, buildFreshPool());
    await kv.set(NEXT_HINT_KEY, 1);
    throw new Error(`Background pool corrupted (saw ${String(bg)}). Pool rebuilt. Try again.`);
  }

  await kv.set(BG_POOL_KEY, pool);
  return bg;
}

async function pushBackgroundId(bg: number) {
  await ensureInitialized();
  if (!Number.isInteger(bg) || bg < 0 || bg >= BACKGROUND_COUNT) return;

  const pool = (await kv.get<number[]>(BG_POOL_KEY)) || [];
  pool.unshift(bg);
  await kv.set(BG_POOL_KEY, pool);
}

async function isMinted(slotId: number) {
  return Boolean(await kv.exists(mintedKey(slotId)));
}

async function cleanupExpiredReservation(slotId: number) {
  const rec = await kv.get<SlotRecord>(reservationKey(slotId));
  if (!rec) return;

  if (Date.now() > rec.expiresAt) {
    await kv.del(reservationKey(slotId));
    await kv.del(walletKey(rec.reservedBy));
    await pushBackgroundId(rec.backgroundId);
  }
}

// ATOMIC claim: try to set reservationKey(slotId) with NX
async function tryClaimSlot(slotId: number, wallet: string): Promise<SlotRecord | null> {
  if (await isMinted(slotId)) return null;

  await cleanupExpiredReservation(slotId);

  const existing = await kv.get<SlotRecord>(reservationKey(slotId));
  if (existing) return null;

  const bg = await popBackgroundId();
  const now = Date.now();

  const rec: SlotRecord = {
    slotId,
    backgroundId: bg,
    reservedBy: wallet,
    reservedAt: now,
    expiresAt: now + RESERVATION_TTL_MS,
  };

  // This is the critical change: NX makes this atomic across tabs/users
  const ok = await kv.set(reservationKey(slotId), rec, { nx: true, ex: RESERVATION_TTL_SECONDS });

  if (!ok) {
    // Someone else beat us; put bg back and move on
    await pushBackgroundId(bg);
    return null;
  }

  await kv.set(walletKey(wallet), slotId, { ex: RESERVATION_TTL_SECONDS });
  return rec;
}

export async function reserveSlot(wallet: string): Promise<SlotRecord> {
  wallet = String(wallet || "").trim();
  if (!wallet) throw new Error("Missing wallet");

  await ensureInitialized();

  // If wallet already has an active reservation, return it
  const existingSlotId = await kv.get<number>(walletKey(wallet));
  if (existingSlotId) {
    await cleanupExpiredReservation(existingSlotId);

    const existing = await kv.get<SlotRecord>(reservationKey(existingSlotId));
    if (existing && existing.reservedBy === wallet) return existing;
  }

  const hint = (await kv.get<number>(NEXT_HINT_KEY)) || 1;
  const start = Math.min(Math.max(hint, 1), TOTAL_SLOTS);

  // Pass 1: start..100
  for (let slotId = start; slotId <= TOTAL_SLOTS; slotId++) {
    const claimed = await tryClaimSlot(slotId, wallet);
    if (claimed) {
      await kv.set(NEXT_HINT_KEY, slotId);
      return claimed;
    }
  }

  // Pass 2: 1..start-1
  for (let slotId = 1; slotId < start; slotId++) {
    const claimed = await tryClaimSlot(slotId, wallet);
    if (claimed) {
      await kv.set(NEXT_HINT_KEY, slotId);
      return claimed;
    }
  }

  throw new Error("SOLD_OUT");
}

export async function releaseSlot(slotId: number) {
  const rec = await kv.get<SlotRecord>(reservationKey(slotId));
  if (!rec) return;

  await kv.del(reservationKey(slotId));
  await kv.del(walletKey(rec.reservedBy));
  await pushBackgroundId(rec.backgroundId);

  const hint = (await kv.get<number>(NEXT_HINT_KEY)) || 1;
  if (slotId < hint) await kv.set(NEXT_HINT_KEY, slotId);
}

export async function markSlotMinted(slotId: number) {
  await kv.set(mintedKey(slotId), { mintedAt: Date.now() });

  const rec = await kv.get<SlotRecord>(reservationKey(slotId));
  if (rec) {
    await kv.del(reservationKey(slotId));
    await kv.del(walletKey(rec.reservedBy));
  }

  const hint = (await kv.get<number>(NEXT_HINT_KEY)) || 1;
  if (slotId === hint) {
    let n = hint;
    while (n <= TOTAL_SLOTS && (await isMinted(n))) n++;
    await kv.set(NEXT_HINT_KEY, Math.min(n, TOTAL_SLOTS));
  }
}

export function slotSerial(slotId: number) {
  return String(slotId).padStart(3, "0");
}
