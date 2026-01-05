import fs from "fs";
import bs58 from "bs58";
import path from "path";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity } from "@metaplex-foundation/umi";
import { createSignerFromKeypair } from "@metaplex-foundation/umi";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { mplCore } from "@metaplex-foundation/mpl-core";

function loadSecretBytesFromPath(keypairPath: string): Uint8Array {
  const raw = fs.readFileSync(keypairPath, "utf8").trim();

  if (raw.startsWith("[")) {
    const arr = JSON.parse(raw) as number[];
    return Uint8Array.from(arr);
  }

  return bs58.decode(raw);
}

export function getUmiVipMainnet() {
  const rpc = process.env.SOLANA_MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  const keypairPath =
    process.env.SOLANA_MAINNET_KEYPAIR_PATH ??
    path.join(process.env.USERPROFILE || "", ".config", "solana", "vip-mainnet.json");
  const irys = process.env.IRYS_MAINNET_URL ?? "https://node1.irys.xyz";

  const umi = createUmi(rpc).use(mplCore());

  const secretKey = loadSecretBytesFromPath(keypairPath);
  const kp = umi.eddsa.createKeypairFromSecretKey(secretKey);
  const signer = createSignerFromKeypair(umi, kp);

  umi.use(keypairIdentity(signer)).use(irysUploader({ address: irys }));

  return umi;
}
