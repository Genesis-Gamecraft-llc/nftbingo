// scripts/mint-vip.ts
/**
 * VIP Series mint script (Solana mainnet)
 *
 * Usage:
 *   npx tsx scripts/mint-vip.ts --to <RECIPIENT_PUBKEY> --bg <BG_ID> --vipId <VIP-UNIQUE-ID> [--name "Name"] [--desc "Description"]
 *
 * Example:
 *   npx tsx scripts/mint-vip.ts --to ANeJq...yjAh --bg 0 --vipId VIP-0001 --name "NFTBingo VIP #1"
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import bs58 from "bs58";
import * as mplCore from "@metaplex-foundation/mpl-core";
import { createGenericFile, generateSigner, publicKey } from "@metaplex-foundation/umi";

import { getUmiVipMainnet } from "./umi.vip";
import { attachCollectionToAsset } from "./_core-attach-collection";
import { generateCardImage } from "../lib/cardGenerator/generateImage";

type VipMintEntry = {
  vipId: string;
  to: string;
  bgId: number;
  asset: string;
  tx: string;
  imageUri: string;
  metadataUri: string;
  collection?: string;
  collectionTx?: string | null;
  when: string;
};

type VipMintRegistry = {
  minted: Record<string, VipMintEntry>;
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function mustArg(name: string): string {
  const v = arg(name);
  if (!v) {
    console.log("\nUsage:");
    console.log(
      '  npx tsx scripts/mint-vip.ts --to <RECIPIENT_PUBKEY> --bg <BG_ID> --vipId <VIP-UNIQUE-ID> [--name "Name"] [--desc "Description"]'
    );
    process.exit(1);
  }
  return v;
}

function loadVipCollectionAddress(): string | null {
  // REAL Core Collection file: scripts/vip-collection.json
  const file = path.join(process.cwd(), "scripts", "vip-collection.json");
  if (!fs.existsSync(file)) return null;

  try {
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    const addr =
      json.collectionAddress ||
      json.collection ||
      json.address ||
      json.publicKey ||
      json.id;

    return typeof addr === "string" && addr.length > 0 ? addr : null;
  } catch {
    return null;
  }
}

function loadRegistry(): { file: string; json: VipMintRegistry } {
  const file = path.join(process.cwd(), "scripts", "vip-minted.json");
  if (!fs.existsSync(file)) {
    const fresh: VipMintRegistry = { minted: {} };
    fs.writeFileSync(file, JSON.stringify(fresh, null, 2));
    return { file, json: fresh };
  }
  const json = JSON.parse(fs.readFileSync(file, "utf8")) as VipMintRegistry;
  if (!json.minted) json.minted = {};
  return { file, json };
}

function saveRegistry(file: string, json: VipMintRegistry) {
  fs.writeFileSync(file, JSON.stringify(json, null, 2));
}

function randInt(min: number, max: number): number {
  return crypto.randomInt(min, max + 1);
}

function pickUnique(count: number, min: number, max: number): number[] {
  const set = new Set<number>();
  while (set.size < count) set.add(randInt(min, max));
  return Array.from(set);
}

/**
 * Returns a standard bingo 5x5 in row-major order (length 25).
 * Center slot (index 12) is 0 and MUST be ignored by renderer (no printed "FREE").
 */
function makeBingoNumbers25(): number[] {
  const B = pickUnique(5, 1, 15);
  const I = pickUnique(5, 16, 30);
  const N = pickUnique(4, 31, 45);
  const G = pickUnique(5, 46, 60);
  const O = pickUnique(5, 61, 75);

  const cols: number[][] = [
    B,
    I,
    [N[0], N[1], 0, N[2], N[3]],
    G,
    O,
  ];

  const out: number[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      out.push(cols[col][row]);
    }
  }
  return out;
}

async function main() {
  const to = mustArg("to");
  const bgIdStr = mustArg("bg");
  const vipId = mustArg("vipId");
  const nameArg = arg("name");
  const descArg = arg("desc");

  const bgId = Number(bgIdStr);
  if (!Number.isFinite(bgId) || bgId < 0) {
    throw new Error(`Invalid --bg value: ${bgIdStr}`);
  }

  const umi = getUmiVipMainnet();

  // 1) Numbers
  const numbers = makeBingoNumbers25();
  if (!Array.isArray(numbers) || numbers.length !== 25) {
    throw new Error("Missing card numbers. Expected a 25-number array.");
  }

  // 2) Render VIP card image
  const png = await generateCardImage(numbers, bgId, { seriesFolder: "vip" });

  // 3) Upload image + metadata (Irys)
  const file = createGenericFile(png, `${vipId}.png`, { contentType: "image/png" });
  const [imageUri] = await umi.uploader.upload([file]);

  const nftName = nameArg || `NFTBingo VIP ${vipId}`;
  const nftDesc =
    descArg ||
    "NFTBingo VIP Series — playable bingo card NFT used in the NFTBingo ecosystem.";

  const metadataUri = await umi.uploader.uploadJson({
    name: nftName,
    description: nftDesc,
    image: imageUri,
    attributes: [
      { trait_type: "Series", value: "VIP" },
      { trait_type: "VIP ID", value: vipId },
      { trait_type: "Background", value: String(bgId) },
    ],
    properties: {
      category: "image",
      files: [{ uri: imageUri, type: "image/png" }],
      nftbingo: { version: 1, type: "vip-card", vipId, bgId, numbers },
    },
  });

  // 4) Mint Core Asset
  const createFn: any =
    (mplCore as any).create ?? (mplCore as any).createV1 ?? (mplCore as any).createV2;
  if (!createFn) throw new Error("Could not find mpl-core create() export.");

  const assetSigner = generateSigner(umi);
  const recipient = publicKey(to);

  const mintRes = await createFn(umi, {
    asset: assetSigner,
    name: nftName,
    uri: metadataUri,
    owner: recipient,
  }).sendAndConfirm(umi);

  const sig58 = bs58.encode(mintRes.signature);
  const assetAddr = assetSigner.publicKey.toString();

  // 5) Attach to VIP collection (automatic)
  const collectionAddress = loadVipCollectionAddress();
  let collectionSig: string | null = null;

  if (collectionAddress) {
    try {
      const res = await attachCollectionToAsset({
        umi,
        asset: assetAddr,
        collection: collectionAddress,
      });
      collectionSig = bs58.encode((res as any).signature ?? res.signature);
    } catch (e: any) {
      console.log("⚠️ Collection attach failed (can backfill later):", e?.message ?? e);
    }
  } else {
    console.log("⚠️ No scripts/vip-collection.json found; skipping collection attach.");
  }

  // 6) Registry
  const { file: regFile, json: reg } = loadRegistry();
  reg.minted[vipId] = {
    vipId,
    to,
    bgId,
    asset: assetAddr,
    tx: sig58,
    imageUri,
    metadataUri,
    collection: collectionAddress ?? undefined,
    collectionTx: collectionSig,
    when: new Date().toISOString(),
  };
  saveRegistry(regFile, reg);

  console.log("\n✅ VIP mint complete");
  console.log("Recipient:", to);
  console.log("VIP ID:", vipId);
  console.log("Asset:", assetAddr);
  console.log("TX:", sig58);
  console.log("Image URI:", imageUri);
  console.log("Metadata URI:", metadataUri);
  console.log("Collection:", collectionAddress ?? "(none)");
  console.log("Collection TX:", collectionSig ?? "(none)");
  console.log("Explorer Asset:", `https://explorer.solana.com/address/${assetAddr}`);
  console.log("Explorer TX:", `https://explorer.solana.com/tx/${sig58}`);
  console.log("Registry:", regFile);
}

main().catch((e) => {
  console.error("\n❌ VIP mint failed:", e?.message ?? e);
  process.exit(1);
});
