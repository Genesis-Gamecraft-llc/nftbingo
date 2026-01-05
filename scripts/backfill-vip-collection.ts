// scripts/backfill-vip-collection.ts
import fs from "fs";
import path from "path";
import bs58 from "bs58";
import { getUmiVipMainnet } from "./umi.vip";
import { attachCollectionToAsset } from "./_core-attach-collection";

type VipMintedEntry = {
  vipId?: string;
  to?: string;
  bgId?: number;
  asset?: string;
  assetAddress?: string; // older field name
  tx?: string;
  imageUri?: string;
  metadataUri?: string;
  collection?: string;
  collectionTx?: string | null;
  collectionBackfilledAt?: string;
  collectionBackfillSigBase64?: string;
};

type VipMintedJson = {
  minted: Record<string, VipMintedEntry>;
};

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
function writeJson(file: string, data: any) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

function getPaths() {
  const repoRoot = process.cwd();
  const registryFile = path.join(repoRoot, "scripts", "vip-minted.json");
  const collectionFile = path.join(repoRoot, "scripts", "vip-collection.json");
  return { registryFile, collectionFile };
}

function loadCollectionAddress(): string {
  const { collectionFile } = getPaths();
  if (!fs.existsSync(collectionFile)) {
    throw new Error(`Missing file: ${collectionFile}`);
  }
  const json = readJson(collectionFile);
  const addr =
    json.collectionAddress ||
    json.collection ||
    json.address ||
    json.CollectionAddress;

  if (!addr || typeof addr !== "string") {
    throw new Error(
      `vip-collection.json missing collectionAddress. File: ${collectionFile}`
    );
  }
  return addr;
}

function loadRegistry(): { file: string; json: VipMintedJson } {
  const { registryFile } = getPaths();
  if (!fs.existsSync(registryFile)) {
    throw new Error(`Missing file: ${registryFile}`);
  }
  const json = readJson(registryFile) as VipMintedJson;
  if (!json.minted) json.minted = {};
  return { file: registryFile, json };
}

function toBase58Sig(sig: any): string {
  try {
    return bs58.encode(sig);
  } catch {
    return String(sig);
  }
}

async function main() {
  const umi = getUmiVipMainnet();

  const collectionAddress = loadCollectionAddress();
  const { file: regFile, json: reg } = loadRegistry();

  const entries = Object.entries(reg.minted || {});
  console.log("\n✅ VIP collection backfill starting");
  console.log("Registry:", regFile);
  console.log("Collection (from scripts/vip-collection.json):", collectionAddress);
  console.log("Found entries:", entries.length);

  let ok = 0;
  let fail = 0;

  for (const [vipId, infoAny] of entries) {
    const info = (infoAny || {}) as VipMintedEntry;
    const asset = info.asset || info.assetAddress;

    if (!asset) {
      fail++;
      console.log(`❌ Failed -> ${vipId}: Missing asset address in registry entry`);
      continue;
    }

    try {
      const res = await attachCollectionToAsset({
        umi,
        asset,
        collection: collectionAddress,
      });

      const sig58 = toBase58Sig(res.signature);

      info.collection = collectionAddress;
      info.collectionBackfilledAt = new Date().toISOString();
      info.collectionTx = sig58;
      info.collectionBackfillSigBase64 = Buffer.from(
        bs58.decode(sig58)
      ).toString("base64");

      reg.minted[vipId] = info;

      ok++;
      console.log(`✅ Attached -> ${vipId} (${asset}) tx=${sig58}`);
    } catch (e: any) {
      fail++;
      console.log(`❌ Failed -> ${vipId} (${asset}): ${e?.message ?? e}`);
    }
  }

  writeJson(regFile, reg);

  console.log("\n✅ Backfill complete");
  console.log("OK:", ok);
  console.log("Failed:", fail);
  console.log("Updated registry:", regFile);
}

main().catch((e) => {
  console.error("\n❌ Backfill failed:", e?.message ?? e);
  process.exit(1);
});
