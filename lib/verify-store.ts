export const runtime = "nodejs";

import crypto from "crypto";
import { redis } from "@/lib/upstash";

export type LinkedRoles = {
  players: boolean;
  vip: boolean;
  founders: boolean;
};

export type LinkedRecord = {
  discordUserId: string;
  wallet: string;
  createdAt: number;
  lastCheckAt: number;
  lastRoles: LinkedRoles;
};

type VerifyStateRecord = {
  discordUserId: string;
  nonce: string;
  createdAt: number;
};

function now() {
  return Date.now();
}

function safeParse<T>(raw: any): T | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function randomState() {
  // URL-safe token
  return crypto.randomBytes(24).toString("hex");
}

function randomNonce() {
  return crypto.randomBytes(16).toString("hex");
}

async function setWithTTL(key: string, value: string, ttlSeconds: number) {
  // Upstash redis supports: redis.set(key, value, { ex: ttl })
  // but not all clients are typed the same, so we try both patterns.
  const anyRedis: any = redis as any;
  try {
    await anyRedis.set(key, value, { ex: ttlSeconds });
    return;
  } catch {
    // fallback
  }
  await anyRedis.set(key, value);
  try {
    await anyRedis.expire(key, ttlSeconds);
  } catch {
    // ignore
  }
}

/**
 * Creates a short-lived verification state.
 * This MUST store JSON (stringified), not an object.
 */
export async function createVerifyState(discordUserId: string) {
  const state = randomState();
  const nonce = randomNonce();

  const rec: VerifyStateRecord = {
    discordUserId,
    nonce,
    createdAt: now(),
  };

  // 15 minutes
  await setWithTTL(`verify:state:${state}`, JSON.stringify(rec), 15 * 60);

  return { state, nonce };
}

/**
 * Reads the state record (no delete).
 */
export async function getVerifyState(state: string): Promise<VerifyStateRecord | null> {
  const raw = await redis.get<string>(`verify:state:${state}`);
  return safeParse<VerifyStateRecord>(raw);
}

/**
 * Consumes state record (read then delete).
 */
export async function consumeVerifyState(state: string): Promise<VerifyStateRecord | null> {
  const key = `verify:state:${state}`;
  const raw = await redis.get<string>(key);
  const rec = safeParse<VerifyStateRecord>(raw);
  if (!rec) return null;
  await redis.del(key);
  return rec;
}

/**
 * Cooldown limiter (per Discord user).
 */
export async function checkCooldown(discordUserId: string, seconds: number) {
  const key = `discord:cooldown:${discordUserId}`;
  const anyRedis: any = redis as any;

  const existing = await anyRedis.get(key);
  if (existing) return false;

  await setWithTTL(key, "1", seconds);
  return true;
}

/**
 * Link a Discord user to a wallet and store their last roles.
 */
export async function setLinked(discordUserId: string, wallet: string, roles: LinkedRoles) {
  const rec: LinkedRecord = {
    discordUserId,
    wallet,
    createdAt: now(),
    lastCheckAt: now(),
    lastRoles: roles,
  };

  // forward + reverse mapping + set membership
  await redis.set(`discord:user:${discordUserId}`, JSON.stringify(rec));
  await redis.set(`wallet:discord:${wallet}`, discordUserId);
  await redis.sadd("discord:linked:set", discordUserId);
  return rec;
}

export async function getLinked(discordUserId: string): Promise<LinkedRecord | null> {
  const raw = await redis.get<string>(`discord:user:${discordUserId}`);
  const rec = safeParse<LinkedRecord>(raw);
  return rec;
}

export async function updateLastCheck(discordUserId: string, roles: LinkedRoles) {
  const rec = await getLinked(discordUserId);
  if (!rec) return null;
  rec.lastCheckAt = now();
  rec.lastRoles = roles;
  await redis.set(`discord:user:${discordUserId}`, JSON.stringify(rec));
  return rec;
}

export async function unlink(discordUserId: string) {
  const rec = await getLinked(discordUserId);
  await redis.del(`discord:user:${discordUserId}`);
  await redis.srem("discord:linked:set", discordUserId);
  if (rec?.wallet) await redis.del(`wallet:discord:${rec.wallet}`);
  return true;
}

export async function listLinkedUserIds(limit = 5000) {
  const ids = (await redis.smembers("discord:linked:set")) as string[] | null;
  return (ids || []).slice(0, limit);
}