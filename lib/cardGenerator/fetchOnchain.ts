// lib/cardGenerator/fetchOnchain.ts
import "server-only";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey } from "@metaplex-foundation/umi";
import {
  mplTokenMetadata,
  findMetadataPda,
  safeFetchMetadata,
} from "@metaplex-foundation/mpl-token-metadata";

export type CardOnchainData = {
  numbers: number[]; // expected 25
  backgroundId: number;
  mint: string;
  uri?: string;
};

function getRpcUrl(opts?: { rpcUrl?: string }) {
  return (
    opts?.rpcUrl ||
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com"
  );
}

/**
 * Fetch the Token Metadata "uri" for a mint address using Umi (safe + version-proof).
 */
async function fetchMetadataUriForMint(mintAddress: string, opts?: { rpcUrl?: string }) {
  const rpcUrl = getRpcUrl(opts);
  const umi = createUmi(rpcUrl).use(mplTokenMetadata());

  const mintPk = publicKey(mintAddress);
  const metadataPda = findMetadataPda(umi, { mint: mintPk });

  const md = await safeFetchMetadata(umi, metadataPda);
  if (!md) throw new Error(`No metadata account found for mint: ${mintAddress}`);

  // In Umi token-metadata, `uri` is a top-level string on the metadata model.
  const uri = String((md as any).uri ?? "")
    .replace(/\0/g, "")
    .trim();

  if (!uri) throw new Error(`Metadata URI is empty for mint: ${mintAddress}`);

  return uri;
}

export async function getCardDataFromMint(
  mintAddress: string,
  opts?: { rpcUrl?: string }
): Promise<CardOnchainData> {
  const uri = await fetchMetadataUriForMint(mintAddress, opts);

  const res = await fetch(uri, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch metadata JSON (${res.status}) from URI: ${uri}`);
  }

  const json: any = await res.json();
  const { numbers, backgroundId } = extractCardDataFromJson(json);

  return { numbers, backgroundId, mint: mintAddress, uri };
}

// Old EVM-style function guard
export async function getCardData(_tokenId: number): Promise<CardOnchainData> {
  throw new Error(
    `getCardData(tokenId) is not valid on Solana. Use getCardDataFromMint(mintAddress).`
  );
}

function extractCardDataFromJson(json: any): { numbers: number[]; backgroundId: number } {
  let numbers: number[] | undefined = parseNumbers(json?.numbers);
  let backgroundId: number | undefined = parseNumber(json?.backgroundId);

  if ((!numbers || backgroundId === undefined) && Array.isArray(json?.attributes)) {
    const attrs = json.attributes;

    const bgAttr =
      attrs.find((a: any) => eqTrait(a, "backgroundId")) ||
      attrs.find((a: any) => eqTrait(a, "background")) ||
      attrs.find((a: any) => eqTrait(a, "bg"));

    if (backgroundId === undefined && bgAttr) backgroundId = parseNumber(bgAttr?.value);

    const numAttr =
      attrs.find((a: any) => eqTrait(a, "numbers")) ||
      attrs.find((a: any) => eqTrait(a, "cardNumbers")) ||
      attrs.find((a: any) => eqTrait(a, "bingoNumbers"));

    if (!numbers && numAttr) numbers = parseNumbers(numAttr?.value);
  }

  if (!numbers) numbers = parseNumbers(json?.properties?.numbers);
  if (backgroundId === undefined) backgroundId = parseNumber(json?.properties?.backgroundId);

  // ✅ Support your current mint metadata shape: json.nftbingo.numbers + backgroundId
  if (!numbers) numbers = parseNumbers(json?.nftbingo?.numbers);
  if (backgroundId === undefined) backgroundId = parseNumber(json?.nftbingo?.backgroundId);

  if (!numbers || numbers.length !== 25) {
    throw new Error(
      `Could not extract "numbers" (expected 25). Found: ${JSON.stringify(numbers)}`
    );
  }
  if (backgroundId === undefined || Number.isNaN(backgroundId)) {
    throw new Error(`Could not extract "backgroundId". Found: ${JSON.stringify(backgroundId)}`);
  }

  return { numbers, backgroundId };
}

function eqTrait(attr: any, trait: string) {
  const t = String(attr?.trait_type ?? attr?.traitType ?? "").toLowerCase().trim();
  return t === trait.toLowerCase();
}

function parseNumber(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseNumbers(v: any): number[] | undefined {
  if (v === null || v === undefined) return undefined;

  if (Array.isArray(v)) {
    const arr = v.map((x) => Number(x)).filter((n) => Number.isFinite(n));
    return arr.length ? arr : undefined;
  }

  if (typeof v === "string") {
    const s = v.trim();

    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map((x) => Number(x));
      } catch {}
    }

    if (s.includes(",")) {
      const arr = s
        .split(",")
        .map((p) => Number(p.trim()))
        .filter((n) => Number.isFinite(n));
      return arr.length ? arr : undefined;
    }
  }

  return undefined;
}
