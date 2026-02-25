import { redis } from "@/lib/upstash";
import crypto from "crypto";

export type LinkedRecord = {
  discordUserId: string;
  wallet: string;
  linkedAt: number;
  lastCheckAt: number;
  lastRoles: { players: boolean; vip: boolean; founders: boolean };
};

export async function checkCooldown(discordUserId: string, seconds: number) {
  const key = `cooldown:${discordUserId}`;
  const exists = await redis.get<string>(key);
  if (exists) return false;
  await redis.set(key, "1", { ex: seconds });
  return true;
}

export async function createVerifyState(discordUserId: string) {
  const state = crypto.randomBytes(18).toString("hex");
  const nonce = crypto.randomBytes(16).toString("hex");

  await redis.set(
    `verify:state:${state}`,
    JSON.stringify({ discordUserId, nonce, createdAt: Date.now() }),
    { ex: 10 * 60 } // 10 minutes
  );

  return { state, nonce };
}

export async function consumeVerifyState(state: string) {
  const key = `verify:state:${state}`;
  const raw = await redis.get<string>(key);
  if (!raw) return null;
  await redis.del(key);
  return JSON.parse(raw) as { discordUserId: string; nonce: string; createdAt: number };
}

export async function setLinked(discordUserId: string, wallet: string, roles: LinkedRecord["lastRoles"]) {
  const rec: LinkedRecord = {
    discordUserId,
    wallet,
    linkedAt: Date.now(),
    lastCheckAt: Date.now(),
    lastRoles: roles,
  };

  await redis.set(`discord:user:${discordUserId}`, JSON.stringify(rec));
  await redis.set(`wallet:discord:${wallet}`, discordUserId);
  await redis.sadd("discord:linked:set", discordUserId);

  return rec;
}

export async function getLinked(discordUserId: string) {
  const raw = await redis.get<string>(`discord:user:${discordUserId}`);
  return raw ? (JSON.parse(raw) as LinkedRecord) : null;
}

export async function updateLastCheck(discordUserId: string, roles: LinkedRecord["lastRoles"]) {
  const rec = await getLinked(discordUserId);
  if (!rec) return null;
  rec.lastCheckAt = Date.now();
  rec.lastRoles = roles;
  await redis.set(`discord:user:${discordUserId}`, JSON.stringify(rec));
  return rec;
}

export async function unlink(discordUserId: string) {
  const rec = await getLinked(discordUserId);
  await redis.del(`discord:user:${discordUserId}`);
  if (rec?.wallet) await redis.del(`wallet:discord:${rec.wallet}`);
  await redis.srem("discord:linked:set", discordUserId);
}

export async function listLinkedUserIds(limit = 5000) {
  // Upstash returns string[] here; don't use generics
  const ids = (await redis.smembers("discord:linked:set")) as string[] | null;
  return (ids || []).slice(0, limit);
}