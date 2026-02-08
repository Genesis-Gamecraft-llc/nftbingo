// app/api/cards/owned/route.ts
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import {
  mplTokenMetadata,
  findMetadataPda,
  safeFetchMetadata,
} from "@metaplex-foundation/mpl-token-metadata";

function envAny(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return "";
}

const RPC_URL =
  envAny("SOLANA_RPC_URL", "NEXT_PUBLIC_SOLANA_RPC_URL") ||
  "https://api.mainnet-beta.solana.com";

// Allowed collections (your env names)
const FOUNDERS_COLLECTION_MINT = envAny(
  "FOUNDERS_COLLECTION_MINT",
  "NEXT_PUBLIC_FOUNDERS_COLLECTION_MINT"
);
const PLAYER_COLLECTION_MINT = envAny(
  "PLAYER_SERIES_COLLECTION_MINT",
  "NEXT_PUBLIC_PLAYER_SERIES_COLLECTION_MINT"
);
const VIP_COLLECTION_MINT = envAny(
  "VIP_COLLECTION_MINT",
  "VIP_SERIES_COLLECTION_MINT",
  "NEXT_PUBLIC_VIP_COLLECTION_MINT",
  "NEXT_PUBLIC_VIP_SERIES_COLLECTION_MINT"
);

const ALLOWED_COLLECTIONS = new Set(
  [FOUNDERS_COLLECTION_MINT, PLAYER_COLLECTION_MINT, VIP_COLLECTION_MINT].filter(Boolean)
);

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetries<T>(fn: () => Promise<T>, tries = 6) {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      await sleep(250 * (i + 1));
    }
  }
  throw lastErr;
}

function unwrapCollectionKeyFromMd(md: any): string {
  // md.collection is Option<Collection>
  if (md?.collection?.__option === "Some") return String(md.collection.value.key);
  return "";
}

function seriesFromCollectionKey(collectionKey: string) {
  if (FOUNDERS_COLLECTION_MINT && collectionKey === FOUNDERS_COLLECTION_MINT) return "FOUNDERS";
  if (PLAYER_COLLECTION_MINT && collectionKey === PLAYER_COLLECTION_MINT) return "PLAYER";
  if (VIP_COLLECTION_MINT && collectionKey === VIP_COLLECTION_MINT) return "VIP";
  return "UNKNOWN";
}

async function fetchJson(uri: string) {
  if (!uri) return null;
  try {
    const r = await withRetries(() => fetch(uri, { cache: "no-store" }), 4);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function getAttr(json: any, trait: string) {
  const attrs = Array.isArray(json?.attributes) ? json.attributes : [];
  const t = trait.toLowerCase();
  const a = attrs.find((x: any) => String(x?.trait_type || "").toLowerCase() === t);
  return a?.value;
}

function looksLikeVip(json: any) {
  // VIP cards in your screenshot have:
  // Series = VIP, Edition = VIP Series, VIP ID = VIP-0001
  const series = String(getAttr(json, "Series") || "").toUpperCase();
  const edition = String(getAttr(json, "Edition") || "").toUpperCase();
  const vipId = String(getAttr(json, "VIP ID") || getAttr(json, "VIP_ID") || "").toUpperCase();

  return (
    series === "VIP" ||
    edition.includes("VIP") ||
    vipId.startsWith("VIP-") ||
    vipId.startsWith("VIP_")
  );
}

function extractNumbersByLetter(json: any): any | undefined {
  // Founders/Players standard
  if (json?.nftbingo?.numbersByLetter) return json.nftbingo.numbersByLetter;
  if (json?.numbersByLetter) return json.numbersByLetter;

  // VIP style: B/I/N/G/O as comma-separated strings (N includes FREE)
  const b = getAttr(json, "B");
  const i = getAttr(json, "I");
  const n = getAttr(json, "N");
  const g = getAttr(json, "G");
  const o = getAttr(json, "O");

  const parse = (v: any) => {
    if (v == null) return null;
    return String(v)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => (x.toUpperCase() === "FREE" ? "FREE" : Number(x)));
  };

  const B = parse(b);
  const I = parse(i);
  const N = parse(n);
  const G = parse(g);
  const O = parse(o);
  if (!B || !I || !N || !G || !O) return undefined;

  const Bn = B.map((x) => Number(x)).filter(Number.isFinite);
  const In = I.map((x) => Number(x)).filter(Number.isFinite);
  const Nn = N.filter((x) => x !== "FREE").map((x) => Number(x)).filter(Number.isFinite);
  const Gn = G.map((x) => Number(x)).filter(Number.isFinite);
  const On = O.map((x) => Number(x)).filter(Number.isFinite);

  if (Bn.length < 5 || In.length < 5 || Nn.length < 4 || Gn.length < 5 || On.length < 5) {
    return undefined;
  }

  return {
    B: Bn.slice(0, 5),
    I: In.slice(0, 5),
    N: Nn.slice(0, 4), // center is FREE
    G: Gn.slice(0, 5),
    O: On.slice(0, 5),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerStr = (searchParams.get("owner") || "").trim();
    if (!ownerStr) {
      return NextResponse.json({ ok: false, error: "Missing owner" }, { status: 400 });
    }

    const owner = new PublicKey(ownerStr);
    const connection = new Connection(RPC_URL, "confirmed");
    const umi = createUmi(connection).use(mplTokenMetadata());

    // Pull token accounts from BOTH programs (safe, fast)
    const [accsLegacy, accs2022] = await Promise.all([
      withRetries(() =>
        connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID })
      ),
      withRetries(() =>
        connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID })
      ),
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
    if (!mints.length) return NextResponse.json({ ok: true, cards: [] });

    // IMPORTANT: cap work so public RPC doesn't melt the server
    const MAX_MINTS = 250;
    const scanMints = mints.slice(0, MAX_MINTS);

    const cards: any[] = [];

    for (const mintStr of scanMints) {
      try {
        const mintPk = umiPublicKey(mintStr);
        const mdPda = findMetadataPda(umi, { mint: mintPk });
        const md = await withRetries(() => safeFetchMetadata(umi, mdPda), 4);
        if (!md) continue;

        const name = String(md.name || "").replace(/\0/g, "").trim();
        const symbol = String(md.symbol || "").replace(/\0/g, "").trim();
        const uri = String(md.uri || "").replace(/\0/g, "").trim();

        // First: allow by verified collection if present
        const collectionKey = unwrapCollectionKeyFromMd(md);
        const collectionAllowed = !!collectionKey && ALLOWED_COLLECTIONS.has(collectionKey);

        // If not allowed by collection, try VIP JSON heuristic (Series=VIP etc)
        const json = await fetchJson(uri);
        const vipLike = json ? looksLikeVip(json) : false;

        // Accept if:
        // - collection matches one of your three allowed collections
        // - OR it looks like VIP by JSON attributes (then we assign VIP collectionKey for labeling)
        if (!collectionAllowed && !vipLike) continue;

        const finalCollectionKey =
          collectionAllowed
            ? collectionKey
            : (VIP_COLLECTION_MINT || collectionKey || "");

        const series =
          seriesFromCollectionKey(finalCollectionKey) !== "UNKNOWN"
            ? seriesFromCollectionKey(finalCollectionKey)
            : (vipLike ? "VIP" : "UNKNOWN");

        const numbersByLetter = json ? extractNumbersByLetter(json) : undefined;

        cards.push({
          mint: mintStr,
          name: name || json?.name || "NFTBingo Card",
          symbol: symbol || json?.symbol || "",
          uri,
          image: json?.image,
          collectionKey: finalCollectionKey,
          series,
          tier: String(getAttr(json, "Tier") || ""),
          numbersByLetter,
        });
      } catch {
        // NEVER fail the whole endpoint because of one mint
        continue;
      }
    }

    return NextResponse.json({ ok: true, cards });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
