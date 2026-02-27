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

/**
 * FIX:
 * Upstash may return either a string (raw JSON) OR an already-parsed object.
 * The old version returned null for non-strings, causing "State expired or invalid."
 */
function safeParse<T>(raw: any): T | null {
  if (!raw) return null;

  // If Upstash returns an object already, accept it.
  if (typeof raw === "object") return raw as T;

  // If it's a string, parse as JSON.
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  return null;
}

function randomState() {
  return crypto.randomBytes(24).toString("hex");
}

function randomNonce() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Upstash Redis supports SET with EX.
 * We DO NOT fallback silently — if this fails, something is wrong and we want to know.
 */
async function setJsonWithTTL(key: string, obj: any, ttlSeconds: number) {
  const value = JSON.stringify(obj);
  // Upstash client supports: redis.set(key, value, { ex: ttl })
  await (redis as any).set(key, value, { ex: ttlSeconds });
}

export async function createVerifyState(discordUserId: string) {
  const state = randomState();
  const nonce = randomNonce();

  const rec: VerifyStateRecord = {
    discordUserId,
    nonce,
    createdAt: now(),
  };

  // 15 minutes
  await setJsonWithTTL(`verify:state:${state}`, rec, 15 * 60);

  return { state, nonce };
}

export async function getVerifyState(state: string): Promise<VerifyStateRecord | null> {
  const raw = await redis.get<any>(`verify:state:${state}`);
  return safeParse<VerifyStateRecord>(raw);
}

export async function consumeVerifyState(state: string): Promise<VerifyStateRecord | null> {
  const key = `verify:state:${state}`;
  const raw = await redis.get<any>(key);
  const rec = safeParse<VerifyStateRecord>(raw);
  if (!rec) return null;
  await redis.del(key);
  return rec;
}

export async function checkCooldown(discordUserId: string, seconds: number) {
  const key = `discord:cooldown:${discordUserId}`;
  const existing = await (redis as any).get(key);
  if (existing) return false;
  await (redis as any).set(key, "1", { ex: seconds });
  return true;
}

export async function setLinked(discordUserId: string, wallet: string, roles: LinkedRoles) {
  const rec: LinkedRecord = {
    discordUserId,
    wallet,
    createdAt: now(),
    lastCheckAt: now(),
    lastRoles: roles,
  };

  await redis.set(`discord:user:${discordUserId}`, JSON.stringify(rec));
  await redis.set(`wallet:discord:${wallet}`, discordUserId);
  await redis.sadd("discord:linked:set", discordUserId);
  return rec;
}

export async function getLinked(discordUserId: string): Promise<LinkedRecord | null> {
  const raw = await redis.get<any>(`discord:user:${discordUserId}`);
  return safeParse<LinkedRecord>(raw);
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