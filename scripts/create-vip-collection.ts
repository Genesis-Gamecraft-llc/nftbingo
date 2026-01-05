// scripts/create-vip-collection.ts
import "dotenv/config";
import fs from "fs";
import path from "path";

import * as mplCore from "@metaplex-foundation/mpl-core";
import { createGenericFile, generateSigner } from "@metaplex-foundation/umi";

import { getUmiVipMainnet } from "./umi.vip";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const umi = getUmiVipMainnet();

  const imagePath =
    arg("image") ||
    path.join(process.cwd(), "public", "backgrounds", "vip", "vip-collection.png");

  const name = arg("name") || "NFTBingo VIP Collection";
  const symbol = arg("symbol") || "NFTBINGO-VIP";
  const description =
    arg("desc") ||
    "Official collection for NFTBingo VIP Core cards.";

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Missing collection image at: ${imagePath}`);
  }

  // 1) Upload collection image
  const imageBuffer = fs.readFileSync(imagePath);
  const imageFile = createGenericFile(imageBuffer, path.basename(imagePath), {
    contentType: "image/png",
  });

  const [imageUri] = await umi.uploader.upload([imageFile]);

  // 2) Upload collection metadata JSON
  const metadata = {
    name,
    symbol,
    description,
    image: imageUri,
    attributes: [
      { trait_type: "Project", value: "NFTBingo" },
      { trait_type: "Type", value: "VIP Collection" },
    ],
    properties: {
      category: "image",
      files: [{ uri: imageUri, type: "image/png" }],
      nftbingo: { version: 1, type: "vip-collection" },
    },
  };

  const metadataUri = await umi.uploader.uploadJson(metadata);

  // 3) Create a REAL Core Collection account (NOT a regular asset)
  const createCollectionFn: any =
    (mplCore as any).createCollection ??
    (mplCore as any).createCollectionV1 ??
    (mplCore as any).createCollectionV2;

  if (!createCollectionFn) {
    throw new Error(
      "Could not find createCollection export from @metaplex-foundation/mpl-core. Version mismatch."
    );
  }

  const collectionSigner = generateSigner(umi);

  const res: any = await createCollectionFn(umi, {
    collection: collectionSigner,
    name,
    uri: metadataUri,
    updateAuthority: umi.identity,
  }).sendAndConfirm(umi);

  const collectionAddress = collectionSigner.publicKey.toString();

  const out = {
    name,
    symbol,
    description,
    collectionAddress,
    imageUri,
    metadataUri,
    signatureBase64: Buffer.from(res.signature).toString("base64"),
    explorer: `https://explorer.solana.com/address/${collectionAddress}`,
    createdAt: new Date().toISOString(),
  };

  const outPath = path.join(process.cwd(), "scripts", "vip-collection.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");

  console.log("\n✅ VIP collection created (REAL Core Collection)");
  console.log("Collection Address:", collectionAddress);
  console.log("Image URI:", imageUri);
  console.log("Metadata URI:", metadataUri);
  console.log("Saved to:", outPath);
  console.log("Explorer:", out.explorer);
  console.log("Signature (base64):", out.signatureBase64);
}

main().catch((e) => {
  console.error("\n❌ Create VIP collection failed:", e?.message ?? e);
  process.exit(1);
});
