// scripts/mint-vip.ts
import "dotenv/config";
import fs from "fs";
import path from "path";
import bs58 from "bs58";

import * as mplCore from "@metaplex-foundation/mpl-core";
import {
  createGenericFile,
  generateSigner,
  publicKey,
} from "@metaplex-foundation/umi";

import { getUmiVipMainnet } from "./umi.vip";
import { attachCollectionToAsset } from "./_core-attach-collection";
import { generateCardImage } from "../lib/cardGenerator/generateImage";

// ---------------- CLI helpers ----------------
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function usageAndExit() {
  console.log(`
Usage:
  npx tsx scripts/mint-vip.ts --to <RECIPIENT_PUBKEY> --bg <BG_ID> --vipId <VIP-UNIQUE-ID> [--name "Name"] [--desc "Description"]

Example:
  npx tsx scripts/mint-vip.ts --to 33UA...gz1C --bg 0 --vipId VIP-0001 --name "NFTBingo VIP #1"
`.trim());
  process.exit(1);
}

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

function loadRegistry() {
  // Your current file lives here:
  // G:\GameDev\nftbingo\scripts\vip-minted.json
  const file = path.join(process.cwd(), "scripts", "vip-minted.json");
  if (!fs.existsSync(file)) {
    return { file, json: { minted: {} as Record<string, VipMintEntry> } };
  }
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!json.minted) json.minted = {};
  return { file, json };
}

function saveRegistry(file: string, json: any) {
  fs.writeFileSync(file, JSON.stringify(json, null, 2), "utf8");
}

function loadCollectionAddress(): string | null {
  // create-vip-collection saved to repo root: vip-collection.json
  const candidates = [
    path.join(process.cwd(), "vip-collection.json"),
    path.join(process.cwd(), "scripts", "vip-collection.json"),
  ];

  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(f, "utf8"));
      const addr =
        j.collectionAddress ??
        j.address ??
        j.collection ??
        j.collectionPk ??
        null;
      if (addr) return String(addr);
    } catch {}
  }

  return null;
}

async function main() {
  const toRaw = arg("to");
  const bgRaw = arg("bg");
  const vipIdRaw = arg("vipId");
  const nameArg = arg("name");
  const descArg = arg("desc");

  if (!toRaw || !bgRaw || !vipIdRaw) usageAndExit();

  const to = String(toRaw);
  const vipId = String(vipIdRaw);
  const bgId = Number(bgRaw);

  if (!Number.isFinite(bgId) || bgId < 0) {
    throw new Error(`Invalid --bg "${bgRaw}" (must be a non-negative number).`);
  }

  const umi = getUmiVipMainnet();

  // Resolve create() export across mpl-core versions
  const createFn: any =
    (mplCore as any).create ??
    (mplCore as any).createV1 ??
    (mplCore as any).createV2;

  if (!createFn) {
    throw new Error("Could not find mpl-core create() export. mpl-core version mismatch.");
  }

  // 1) Generate numbers (VIP can still be a playable card)
  //    Use your existing scheme: 25 numbers with FREE encoded as 0 at index 12.
  //    Here we just do a simple random for now; if you already have a generator, swap it in.
  const numbers: number[] = Array.from({ length: 25 }, (_, i) => (i === 12 ? 0 : 1 + i));

  // 2) Render VIP card image (VIP backgrounds live in /public/backgrounds/vip/)
  const png = await generateCardImage(numbers, bgId, "vip");

  // 3) Upload image + metadata via Umi uploader (Irys)
  const file = createGenericFile(png, `${vipId}.png`, { contentType: "image/png" });
  const imageUri = await umi.uploader.upload([file]).then((x: string[]) => x[0]);

  const nftName = nameArg ?? `NFTBingo VIP ${vipId}`;
  const description =
    descArg ??
    "NFTBingo VIP card. One-of-one VIP series card used in the NFTBingo game ecosystem.";

  const metadataUri = await umi.uploader.uploadJson({
    name: nftName,
    description,
    image: imageUri,
    attributes: [
      { trait_type: "Project", value: "NFTBingo" },
      { trait_type: "Series", value: "VIP" },
      { trait_type: "VIP ID", value: vipId },
      { trait_type: "Background", value: `backgrounds/vip/bg${bgId}.png` },
      { trait_type: "Encoding", value: "row-major-25" },
      { trait_type: "Free Index", value: 12 },
    ],
    properties: {
      category: "image",
      files: [{ uri: imageUri, type: "image/png" }],
      nftbingo: {
        version: 1,
        type: "vip-card",
        vipId,
        bgId,
        encoding: "row-major-25",
        freeIndex: 12,
        backgroundPath: `backgrounds/vip/bg${bgId}.png`,
        numbers,
      },
    },
  });

  // 4) Mint Core asset directly to recipient
  const assetSigner = generateSigner(umi);
  const recipient = publicKey(to);

  const mintRes = await createFn(umi, {
    asset: assetSigner,
    name: nftName,
    uri: metadataUri,
    owner: recipient,
  }).sendAndConfirm(umi);

  const tx = bs58.encode((mintRes as any).signature);
  const assetAddr = assetSigner.publicKey.toString();

  // 5) Attach to VIP collection (if present)
  const collectionAddress = loadCollectionAddress();
  let collectionTx: string | null = null;

  if (collectionAddress) {
    try {
      const res = await attachCollectionToAsset({
        umi,
        asset: assetAddr,
        collection: collectionAddress,
      });
      if (res?.signature) collectionTx = bs58.encode(res.signature);
    } catch (e: any) {
      console.log("⚠️ Collection attach failed (can backfill later):", e?.message ?? e);
    }
  } else {
    console.log("⚠️ No vip-collection.json found; skipping collection attach.");
  }

  // 6) Save registry
  const { file: regFile, json } = loadRegistry();
  json.minted[vipId] = {
    vipId,
    to,
    bgId,
    asset: assetAddr,
    tx,
    imageUri,
    metadataUri,
    collection: collectionAddress ?? undefined,
    collectionTx,
    when: new Date().toISOString(),
  };

  saveRegistry(regFile, json);

  console.log("\n✅ VIP mint complete");
  console.log("Recipient:", to);
  console.log("VIP ID:", vipId);
  console.log("Asset:", assetAddr);
  console.log("TX:", tx);
  console.log("Image URI:", imageUri);
  console.log("Metadata URI:", metadataUri);
  console.log("Explorer Asset:", `https://explorer.solana.com/address/${assetAddr}`);
  console.log("Explorer TX:", `https://explorer.solana.com/tx/${tx}`);
  console.log("Registry:", regFile);
  if (collectionAddress) {
    console.log("Collection:", collectionAddress);
    if (collectionTx) console.log("Collection Attach TX:", collectionTx);
  }
}

main().catch((e) => {
  console.error("\n❌ VIP mint failed:", (e as any)?.message ?? e);
  process.exit(1);
});
