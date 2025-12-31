import { Connection, PublicKey } from "@solana/web3.js";
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";

export type CardOnchainData = {
  numbers: number[]; // expected 25
  backgroundId: number;
  mint: string;
  uri?: string;
};

// Metaplex Token Metadata program id (stable)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export async function getCardDataFromMint(
  mintAddress: string,
  opts?: { rpcUrl?: string }
): Promise<CardOnchainData> {
  const rpcUrl =
    opts?.rpcUrl ||
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.devnet.solana.com";

  const connection = new Connection(rpcUrl, "confirmed");
  const mint = new PublicKey(mintAddress);

  // Derive Metadata PDA: ["metadata", token_metadata_program_id, mint]
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  );

  const acct = await connection.getAccountInfo(metadataPda);
  if (!acct?.data) {
    throw new Error(`No metadata account found for mint: ${mintAddress}`);
  }

  // v2 SDK: deserialize directly from account data
  const [metadata] = Metadata.deserialize(acct.data);
  const uri = (metadata.data.uri || "").replace(/\0/g, "").trim();

  if (!uri) {
    throw new Error(`Metadata URI is empty for mint: ${mintAddress}`);
  }

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
