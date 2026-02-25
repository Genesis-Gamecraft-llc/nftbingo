// app/api/cards/owned/route.ts
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { mplTokenMetadata, findMetadataPda, safeFetchMetadata } from "@metaplex-foundation/mpl-token-metadata";

function envAny(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return "";
}

/**
 * IMPORTANT:
 * - This route is for GAME card pulling, not minting.
 * - Prefer Alchemy (NEXT_PUBLIC_SOLANA_RPC_URL) so we don't touch mint's SOLANA_RPC_URL.
 */
const GAME_RPC_URL =
  envAny("SOLANA_GAME_RPC_URL", "NEXT_PUBLIC_SOLANA_RPC_URL", "NEXT_PUBLIC_SOLANA_RPC") ||
  "https://api.mainnet-beta.solana.com";

const FOUNDERS_COLLECTION_MINT = envAny("FOUNDERS_COLLECTION_MINT", "NEXT_PUBLIC_FOUNDERS_COLLECTION_MINT");
const PLAYER_COLLECTION_MINT = envAny("PLAYER_SERIES_COLLECTION_MINT", "NEXT_PUBLIC_PLAYER_SERIES_COLLECTION_MINT");

const ALLOWED_COLLECTIONS = new Set([FOUNDERS_COLLECTION_MINT, PLAYER_COLLECTION_MINT].filter(Boolean));

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetries<T>(fn: () => Promise<T>, tries = 5) {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      await sleep(200 * (i + 1));
    }
  }
  throw lastErr;
}

function unwrapCollectionKey(md: any): string {
  if (md?.collection?.__option === "Some") return String(md.collection.value.key);
  return "";
}

function seriesFromCollectionKey(collectionKey: string) {
  if (FOUNDERS_COLLECTION_MINT && collectionKey === FOUNDERS_COLLECTION_MINT) return "FOUNDERS";
  if (PLAYER_COLLECTION_MINT && collectionKey === PLAYER_COLLECTION_MINT) return "PLAYER";
  return "UNKNOWN";
}

function getAttr(json: any, trait: string) {
  const attrs = Array.isArray(json?.attributes) ? json.attributes : [];
  const t = trait.toLowerCase();
  const a = attrs.find((x: any) => String(x?.trait_type || "").toLowerCase() === t);
  return a?.value;
}

async function fetchJsonWithTimeout(uri: string, ms = 8000) {
  if (!uri) return null;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);

  try {
    const r = await withRetries(
      () => fetch(uri, { cache: "no-store", signal: controller.signal }),
      3
    );
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Tiny in-memory cache (works great on a single Node process).
 * If you run multiple server instances, consider Upstash/Redis later.
 */
type CacheEntry = { exp: number; value: any };
const CACHE_TTL_MS = 90_000; // 90s
const cache = (globalThis as any).__nbg_owned_cache ?? ((globalThis as any).__nbg_owned_cache = new Map<string, CacheEntry>());

/**
 * In-flight dedupe: if 10 requests hit same owner at once, only do the work once.
 */
const inflight = (globalThis as any).__nbg_owned_inflight ?? ((globalThis as any).__nbg_owned_inflight = new Map<string, Promise<any>>());

/**
 * Global concurrency limiter for metadata/uri fetch work across requests.
 */
class Semaphore {
  private n: number;
  private q: Array<() => void> = [];
  constructor(n: number) {
    this.n = n;
  }
  async acquire() {
    if (this.n > 0) {
      this.n--;
      return;
    }
    await new Promise<void>((resolve) => this.q.push(resolve));
    this.n--;
  }
  release() {
    this.n++;
    const next = this.q.shift();
    if (next) next();
  }
}
const SEM = (globalThis as any).__nbg_owned_sem ?? ((globalThis as any).__nbg_owned_sem = new Semaphore(10)); // total concurrent heavy ops

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });

  await Promise.all(workers);
  return out;
}

async function computeCards(ownerStr: string) {
  const owner = new PublicKey(ownerStr);

  // NOTE: confirmed is fine for reads; use finalized only if you have a strict reason.
  const connection = new Connection(GAME_RPC_URL, "confirmed");
  const umi = createUmi(connection).use(mplTokenMetadata());

  const [accsLegacy, accs2022] = await Promise.all([
    withRetries(() => connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID })),
    withRetries(() => connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID })),
  ]);

  const mintSet = new Set<string>();
  const collect = (resp: any) => {
    for (const it of resp.value) {
      const info: any = it.account?.data?.parsed?.info;
      const amount = Number(info?.tokenAmount?.amount || 0);
      const decimals = Number(info?.tokenAmount?.decimals || 0);
      if (amount === 1 && decimals === 0) {
        const mint = String(info?.mint || "");
        if (mint) mintSet.add(mint);
      }
    }
  };

  collect(accsLegacy);
  collect(accs2022);

  const mints = Array.from(mintSet);
  if (!mints.length) return [];

  const MAX_MINTS = 250;
  const scanMints = mints.slice(0, MAX_MINTS);

  const results = await mapLimit(scanMints, 8, async (mintStr) => {
    await SEM.acquire();
    try {
      const mintPk = umiPublicKey(mintStr);

      const mdPda = findMetadataPda(umi, { mint: mintPk });
      const md = await withRetries(() => safeFetchMetadata(umi, mdPda), 3);
      if (!md) return null;

      const collectionKey = unwrapCollectionKey(md);
      if (!collectionKey || !ALLOWED_COLLECTIONS.has(collectionKey)) return null;

      const name = String(md.name || "").replace(/\0/g, "").trim();
      const symbol = String(md.symbol || "").replace(/\0/g, "").trim();
      const uri = String(md.uri || "").replace(/\0/g, "").trim();

      const json = await fetchJsonWithTimeout(uri, 8000);
      const numbersByLetter = json?.nftbingo?.numbersByLetter || json?.numbersByLetter || undefined;

      return {
        mint: mintStr,
        name: name || json?.name || "NFTBingo Card",
        symbol: symbol || json?.symbol || "",
        uri,
        image: json?.image,
        collectionKey,
        series: seriesFromCollectionKey(collectionKey),
        tier: String(getAttr(json, "Tier") || ""),
        numbersByLetter,
      };
    } catch {
      return null;
    } finally {
      SEM.release();
    }
  });

  return results.filter(Boolean);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerStr = (searchParams.get("owner") || "").trim();

    if (!ownerStr) {
      return NextResponse.json({ ok: false, error: "Missing owner" }, { status: 400 });
    }

    // cache hit
    const now = Date.now();
    const cached = cache.get(ownerStr);
    if (cached && cached.exp > now) {
      return NextResponse.json({ ok: true, cards: cached.value });
    }

    // inflight dedupe
    const existing = inflight.get(ownerStr);
    if (existing) {
      const cards = await existing;
      return NextResponse.json({ ok: true, cards });
    }

    const p = (async () => {
      const cards = await computeCards(ownerStr);
      cache.set(ownerStr, { exp: now + CACHE_TTL_MS, value: cards });
      return cards;
    })();

    inflight.set(ownerStr, p);

    try {
      const cards = await p;
      return NextResponse.json({ ok: true, cards });
    } finally {
      inflight.delete(ownerStr);
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}