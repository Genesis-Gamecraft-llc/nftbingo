import "dotenv/config";

import fs from "fs";
import path from "path";

import * as mplCore from "@metaplex-foundation/mpl-core";
import { createGenericFile, publicKey } from "@metaplex-foundation/umi";
import { getUmiVipMainnet } from "./umi.vip";

// ---------- CLI helpers ----------
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const collectionStr = arg("collection");
const imagePathArg = arg("imagePath");
const nameArg = arg("name");
const descArg = arg("desc");

if (!collectionStr || !imagePathArg) {
  console.log(`
Usage:
  npx tsx scripts/update-vip-collection.ts --collection <COLLECTION_ASSET_ADDRESS> --imagePath <PATH_TO_PNG> [--name "Collection Name"] [--desc "Description"]

Example:
  npx tsx scripts/update-vip-collection.ts --collection AS6c...LSDH --imagePath public/backgrounds/vip/vip-collection.png --name "NFTBingo VIP Collection"
`);
  process.exit(1);
}

const COLLECTION_ASSET = publicKey(collectionStr);

const resolvedImagePath = path.isAbsolute(imagePathArg)
  ? imagePathArg
  : path.join(process.cwd(), imagePathArg);

if (!fs.existsSync(resolvedImagePath)) {
  console.error(`❌ Image file not found: ${resolvedImagePath}`);
  process.exit(1);
}

// mpl-core has had different export names across versions
const updateFn: any =
  (mplCore as any).update ??
  (mplCore as any).updateV1 ??
  (mplCore as any).updateV2;

async function main() {
  const umi = getUmiVipMainnet();

  if (!updateFn) {
    throw new Error(
      "Could not find update export from @metaplex-foundation/mpl-core (update/updateV1). Your mpl-core version may be incompatible."
    );
  }

  // 1) Upload image to Arweave (via Irys)
  const imageBuffer = fs.readFileSync(resolvedImagePath);
  const fileName = `nftbingo-vip-collection-${Date.now()}.png`;

  const imgFile = createGenericFile(imageBuffer, fileName, { contentType: "image/png" });
  const [imageUri] = await umi.uploader.upload([imgFile]);

  // 2) Upload metadata JSON
  const collectionName = nameArg ?? "NFTBingo VIP Collection";
  const description =
    descArg ??
    "Official verified collection for NFTBingo VIP 1-of-1 cards. Image + metadata stored permanently on Arweave.";

  const metadataUri = await umi.uploader.uploadJson({
    name: collectionName,
    description,
    image: imageUri,
    attributes: [
      { trait_type: "Project", value: "NFTBingo" },
      { trait_type: "Collection", value: "VIP" },
      { trait_type: "Type", value: "Collection Root" },
    ],
    properties: {
      category: "image",
      files: [{ uri: imageUri, type: "image/png" }],
      nftbingo: { version: 1, type: "vip-collection" },
    },
  });

  // 3) Update collection asset (authority must be your mainnet signer)
  const builder = updateFn(umi, {
    asset: COLLECTION_ASSET as any,
    authority: umi.identity as any,
    name: collectionName,
    uri: metadataUri,
  });

  const res = await builder.sendAndConfirm(umi);

  console.log("\n✅ Collection updated");
  console.log("Collection:", collectionStr);
  console.log("New Image URI:", imageUri);
  console.log("New Metadata URI:", metadataUri);
  console.log("Explorer:", `https://explorer.solana.com/address/${collectionStr}`);
  console.log("Signature (base64):", Buffer.from(res.signature).toString("base64"));
}

main().catch((e) => {
  console.error("\n❌ Update failed:", e?.message ?? e);
  process.exit(1);
});
