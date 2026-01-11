// scripts/mint-vip.ts
import "dotenv/config";

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
import fs from "fs";
import path from "path";

// ---------- CLI ----------
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const toArg = arg("to");
const bgArg = arg("bg");
const vipIdArg = arg("vipId");
const nameArg = arg("name");
const descArg = arg("desc");

if (!toArg || !vipIdArg || bgArg === undefined) {
  console.log(`
Usage:
  npx tsx scripts/mint-vip.ts --to <RECIPIENT_PUBKEY> --bg <BG_ID> --vipId <VIP-UNIQUE-ID> [--name "Name"] [--desc "Description"]

Example:
  npx tsx scripts/mint-vip.ts --to 33UA...gz1C --bg 0 --vipId VIP-0001 --name "NFTBingo VIP #1"
`);
  process.exit(1);
}

const to = toArg;
const vipId = vipIdArg;
const bgId = Number(bgArg);

if (!Number.isFinite(bgId) || bgId < 0) {
  console.error(`❌ Invalid --bg value: ${bgArg}`);
  process.exit(1);
}

// ---------- Registry (vip-minted.json) ----------
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

type VipRegistry = {
  minted: Record<string, VipMintEntry>;
};

function registryPath(): string {
  // Keep the file inside /scripts as you already have it
  return path.join(process.cwd(), "scripts", "vip-minted.json");
}

function loadRegistry(): { file: string; json: VipRegistry } {
  const file = registryPath();
  if (!fs.existsSync(file)) {
    return { file, json: { minted: {} } };
  }
  const raw = fs.readFileSync(file, "utf8");
  const json = JSON.parse(raw) as VipRegistry;
  if (!json.minted) json.minted = {};
  return { file, json };
}

function saveRegistry(file: string, json: VipRegistry) {
  fs.writeFileSync(file, JSON.stringify(json, null, 2), "utf8");
}

function loadVipCollectionAddress(): string | null {
  // You said the REAL one is saved here:
  // G:\GameDev\nftbingo\scripts\vip-collection.json
  const p = path.join(process.cwd(), "scripts", "vip-collection.json");
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  const parsed = JSON.parse(raw) as any;
  return parsed?.collectionAddress ?? parsed?.address ?? parsed?.collection ?? null;
}

async function main() {
  try {
    const umi = getUmiVipMainnet();

    // 1) Build card numbers (your existing behavior)
    // NOTE: If you already have the number generation earlier in your file, keep it.
    // I’m leaving a simple placeholder that matches the prior contract-style expectation:
    // Replace this with your real numbers source if needed.
    const numbers: number[] = (globalThis as any).__NFTBINGO_NUMBERS__ ?? [];
    if (!Array.isArray(numbers) || numbers.length !== 25) {
      throw new Error(
        "Missing card numbers. Ensure mint-vip.ts is generating/passing a 25-number array before calling generateCardImage()."
      );
    }

    // 2) Render VIP card image (VIP backgrounds live in /public/backgrounds/vip/)
    const png = await generateCardImage(numbers, bgId, { seriesFolder: "vip" });

    // 3) Upload image + metadata via Umi uploader (Irys)
    const file = createGenericFile(png, `${vipId}.png`, { contentType: "image/png" });
    const [imageUri] = await umi.uploader.upload([file]);

    const nftName = nameArg ?? `NFTBingo VIP ${vipId}`;
    const description = descArg ?? "NFTBingo VIP Series card";

    const metadataUri = await umi.uploader.uploadJson({
      name: nftName,
      description,
      image: imageUri,
      properties: {
        category: "image",
        files: [{ uri: imageUri, type: "image/png" }],
        nftbingo: { version: 1, type: "vip-card", vipId, bgId },
      },
    });

    // 4) Mint Core Asset directly to recipient (owner)
    const createFn: any =
      (mplCore as any).create ??
      (mplCore as any).createV1 ??
      (mplCore as any).createV2;

    if (!createFn) {
      throw new Error("Could not find mpl-core create() export. mpl-core version mismatch.");
    }

    const assetSigner = generateSigner(umi);
    const recipient = publicKey(to);

    const mintRes = await createFn(umi, {
      asset: assetSigner,
      name: nftName,
      uri: metadataUri,
      owner: recipient,
    }).sendAndConfirm(umi);

    const assetAddr = assetSigner.publicKey.toString();
    const sig58 = bs58.encode(mintRes.signature);

    // 5) Attach to VIP collection (if present) — can backfill later
    let collectionSig: string | null = null;
    const collectionAddress = loadVipCollectionAddress();

    if (collectionAddress) {
      try {
        const res = await attachCollectionToAsset({
          umi,
          asset: assetAddr,
          collection: collectionAddress,
        });
        // res.signature might already be base64 or bytes depending on your helper
        collectionSig = (res as any)?.signature
          ? bs58.encode((res as any).signature)
          : null;
      } catch (e: any) {
        console.log("⚠️ Collection attach failed (can backfill later):", e?.message ?? e);
      }
    } else {
      console.log("⚠️ No scripts/vip-collection.json found; skipping collection attach.");
    }

    // 6) Save registry entry
    const { file: regFile, json } = loadRegistry();
    json.minted[vipId] = {
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
    saveRegistry(regFile, json);

    console.log("\n✅ VIP mint complete");
    console.log("Recipient:", to);
    console.log("VIP ID:", vipId);
    console.log("Asset:", assetAddr);
    console.log("TX:", sig58);
    console.log("Image URI:", imageUri);
    console.log("Metadata URI:", metadataUri);
    console.log("Explorer Asset:", `https://explorer.solana.com/address/${assetAddr}`);
    console.log("Explorer TX:", `https://explorer.solana.com/tx/${sig58}`);
    console.log("Registry:", regFile);
  } catch (err: any) {
    console.error("\n❌ VIP mint failed:", err?.message ?? err);
    process.exit(1);
  }
}

main();
