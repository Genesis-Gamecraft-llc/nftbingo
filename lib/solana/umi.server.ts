import fs from "fs";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity } from "@metaplex-foundation/umi";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";

/**
 * Load the secret key bytes from env.
 * - Vercel / Production: SOLANA_KEYPAIR_JSON
 * - Local dev fallback: SOLANA_KEYPAIR_PATH
 */
function loadSecretBytes(): Uint8Array {
  let secret: number[];

  if (process.env.SOLANA_KEYPAIR_JSON) {
    secret = JSON.parse(process.env.SOLANA_KEYPAIR_JSON) as number[];
  } else if (process.env.SOLANA_KEYPAIR_PATH) {
    const raw = fs.readFileSync(process.env.SOLANA_KEYPAIR_PATH!, "utf-8");
    secret = JSON.parse(raw) as number[];
  } else {
    throw new Error("Missing Solana keypair. Set SOLANA_KEYPAIR_JSON or SOLANA_KEYPAIR_PATH.");
  }

  return Uint8Array.from(secret);
}

export function getUmiServer() {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("Missing SOLANA_RPC_URL environment variable.");

  const umi = createUmi(rpcUrl).use(
    irysUploader({
      address: process.env.IRYS_URL ?? "https://devnet.irys.xyz",
    })
  );

  // ✅ Create a UMI keypair using the built-in EdDSA instance
  const secretKey = loadSecretBytes();
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);

  // ✅ Use it as the identity signer
  umi.use(keypairIdentity(umiKeypair));

  return umi;
}
