import path from "path";
import dotenv from "dotenv";

// Load Next-style env files for CLI scripts
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") }); // optional fallback

import fs from "fs";


import { Connection, Keypair } from "@solana/web3.js";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mplToolbox } from "@metaplex-foundation/mpl-toolbox";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  createGenericFile,
  createSignerFromKeypair,
  generateSigner,
  keypairIdentity,
  percentAmount,
} from "@metaplex-foundation/umi";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";

function loadKeypairFromEnv(): Keypair {
  const json = process.env.SOLANA_KEYPAIR_JSON?.trim();
  if (json) {
    const secret = Uint8Array.from(JSON.parse(json));
    return Keypair.fromSecretKey(secret);
  }

  const p = process.env.SOLANA_KEYPAIR_PATH?.trim();
  if (p) {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    const raw = fs.readFileSync(abs, "utf8");
    const secret = Uint8Array.from(JSON.parse(raw));
    return Keypair.fromSecretKey(secret);
  }

  throw new Error("Missing SOLANA_KEYPAIR_JSON or SOLANA_KEYPAIR_PATH");
}

function deriveWsUrl(httpUrl: string): string {
  if (httpUrl.startsWith("https://")) return "wss://" + httpUrl.slice("https://".length);
  if (httpUrl.startsWith("http://")) return "ws://" + httpUrl.slice("http://".length);
  return httpUrl;
}

function makeUmiCli() {
  const rpc = process.env.SOLANA_RPC_URL?.trim();
  if (!rpc) throw new Error("Missing SOLANA_RPC_URL");

  const ws = process.env.SOLANA_WS_URL?.trim() || deriveWsUrl(rpc);

  const connection = new Connection(rpc, {
    commitment: "confirmed",
    wsEndpoint: ws,
  });

  const kp = loadKeypairFromEnv();

  const umi = createUmi(connection)
    .use(mplToolbox())
    .use(mplTokenMetadata())
    .use(
      irysUploader({
        address: process.env.IRYS_URL?.trim() || "https://node1.irys.xyz",
      })
    );

  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(kp.secretKey);
  umi.use(keypairIdentity(createSignerFromKeypair(umi, umiKeypair)));

  return umi;
}

async function main() {
  const umi = makeUmiCli();

  // ✅ Your provided image path
  const imageRelPath = "public/backgrounds/player/Founders-Series-Collection.png";
  const imageAbsPath = path.join(process.cwd(), imageRelPath);

  if (!fs.existsSync(imageAbsPath)) {
    throw new Error(`Collection image not found: ${imageAbsPath}`);
  }

  const imageBytes = fs.readFileSync(imageAbsPath);
  const umiFile = createGenericFile(imageBytes, "Player-Series-Collection.png", {
    contentType: "image/png",
  });

  // Upload image (one-time cost)
  const [imageUri] = await umi.uploader.upload([umiFile]);

  const metadata = {
    name: "NFTBingo Player Series",
    symbol: "NFTBingo",
    description: "Official NFTBingo Player Series collection (Free tier playable cards).",
    image: imageUri,
    attributes: [
      { trait_type: "Series", value: "Player" },
      { trait_type: "Tier", value: "Free" },
    ],
    properties: {
      files: [{ uri: imageUri, type: "image/png" }],
      category: "image",
    },
    nftbingo: {
      series: "player",
      tier: "Free",
      type: "collection",
      createdAt: Date.now(),
    },
  };

  console.log("NAME LEN:", metadata.name.length, metadata.name);
console.log("SYMBOL LEN:", metadata.symbol.length, metadata.symbol);

const metadataUri = await umi.uploader.uploadJson(metadata);

  // Mint the collection NFT
  const collectionMint = generateSigner(umi);

  const res = await createNft(umi, {
    mint: collectionMint,
    authority: umi.identity,
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(0, 2),
    isCollection: true,
  }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

  console.log("\n✅ Player Series Collection Created");
  console.log("Mint Address:", collectionMint.publicKey.toString());
  console.log("Image URI:", imageUri);
  console.log("Metadata URI:", metadataUri);
  console.log("Tx Signature:", res.signature.toString());

  console.log("\n➡️ Add this env var:");
  console.log(`PLAYER_SERIES_COLLECTION_MINT=${collectionMint.publicKey.toString()}\n`);
}

main().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
