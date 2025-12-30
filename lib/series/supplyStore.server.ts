// lib/series/supplyStore.server.ts
import "server-only";
import fs from "fs";
import path from "path";

const STORE_PATH = path.join(process.cwd(), "data", "supply.dev.json");

type SupplyMap = Record<string, number>; // key -> minted count

function ensureStoreFile() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, JSON.stringify({}, null, 2), "utf-8");
}

export function getMintedCount(key: string): number {
  ensureStoreFile();
  const raw = fs.readFileSync(STORE_PATH, "utf-8");
  const json = JSON.parse(raw) as SupplyMap;
  return json[key] ?? 0;
}

export function incrementMintedCount(key: string): number {
  ensureStoreFile();
  const raw = fs.readFileSync(STORE_PATH, "utf-8");
  const json = JSON.parse(raw) as SupplyMap;
  const next = (json[key] ?? 0) + 1;
  json[key] = next;
  fs.writeFileSync(STORE_PATH, JSON.stringify(json, null, 2), "utf-8");
  return next;
}
