import "dotenv/config";
import fs from "fs";
import path from "path";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createGenericFile,
  createSignerFromKeypair,
  keypairIdentity,
  percentAmount,
} from "@metaplex-foundation/umi";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { mplTokenMetadata, createNft } from "@metaplex-foundation/mpl-token-metadata";

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function loadSecretKeyFromKeypairFile(keypairPath) {
  if (!fs.existsSync(keypairPath)) {
    throw new Error(`Keypair file not found: ${keypairPath}`);
  }
  const raw = fs.readFileSync(keypairPath, "utf8");
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr) || arr.length < 32) {
    throw new Error(`Invalid keypair JSON at: ${keypairPath}`);
  }
  return new Uint8Array(arr);
}

async function main() {
  const rpc = mustEnv("SOLANA_RPC_URL");
  const keypairPath = mustEnv("SOLANA_KEYPAIR_PATH");
  const irysUrl = process.env.IRYS_URL || "https://node1.irys.xyz";

  console.log("RPC:", rpc);
  console.log("IRYS:", irysUrl);
  console.log("Signer keypair file:", keypairPath);

  const umi = createUmi(rpc)
    .use(mplTokenMetadata())
    .use(irysUploader({ address: irysUrl }));

  const secretKey = loadSecretKeyFromKeypairFile(keypairPath);
  const signer = createSignerFromKeypair(
    umi,
    umi.eddsa.createKeypairFromSecretKey(secretKey)
  );
  umi.use(keypairIdentity(signer));

  console.log("Signer pubkey:", signer.publicKey.toString());

  const imagePath = path.join(process.cwd(), "public", "collections", "founders-series.png");
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Missing collection image: ${imagePath}`);
  }

  const imageBuffer = fs.readFileSync(imagePath);

  // ✅ Umi expects a GenericFile with `content`
  const imageFile = createGenericFile(imageBuffer, "founders-series.png", {
    contentType: "image/png",
  });

  const [imageUri] = await umi.uploader.upload([imageFile]);
  console.log("Uploaded image URI:", imageUri);

  const metadataJson = {
    name: "NFTBingo Founders Series",
    symbol: "NFTBingo",
    description:
      "Official collection NFT for the NFTBingo Founders Series on Solana. This collection groups all Founders Series tiers (Platinum, Gold, Silver).",
    image: imageUri,
    external_url: "http://NFTBingo.net",
    attributes: [
      { trait_type: "Collection", value: "NFTBingo Founders Series" },
      { trait_type: "Type", value: "Collection NFT" },
    ],
    properties: {
      files: [{ uri: imageUri, type: "image/png" }],
      category: "image",
    },
  };

  const metadataUri = await umi.uploader.uploadJson(metadataJson);
  console.log("Uploaded metadata URI:", metadataUri);

  const collectionMintKp = umi.eddsa.generateKeypair();
  const collectionMintSigner = createSignerFromKeypair(umi, collectionMintKp);

  const tx = await createNft(umi, {
    mint: collectionMintSigner,
    name: "NFTBingo Founders Series",
    symbol: "NFTBingo",
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(0),
    isCollection: true,
  }).sendAndConfirm(umi);

  console.log("\n✅ Founders Series collection NFT created!");
  console.log("Collection Mint Address:");
  console.log(collectionMintSigner.publicKey.toString());
  console.log("\nTx signature (raw):");
  console.log(tx.signature?.toString?.() ?? tx);

  console.log("\n➡️  Set this in .env.local:");
  console.log(`FOUNDERS_COLLECTION_MINT=${collectionMintSigner.publicKey.toString()}`);
}

main().catch((err) => {
  console.error("\n❌ Failed to create collection NFT:");
  console.error(err);
  process.exit(1);
});
