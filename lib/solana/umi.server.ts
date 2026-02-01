// lib/solana/umi.server.ts
import "server-only";

import fs from "fs";
import path from "path";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mplToolbox } from "@metaplex-foundation/mpl-toolbox";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { keypairIdentity, createSignerFromKeypair } from "@metaplex-foundation/umi";
import { Keypair, Connection } from "@solana/web3.js";

let _umi: ReturnType<typeof createUmi> | null = null;

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

export function getUmiServer() {
  if (_umi) return _umi;

  const rpc = process.env.SOLANA_RPC_URL?.trim();
  if (!rpc) throw new Error("Missing SOLANA_RPC_URL");

  const ws = process.env.SOLANA_WS_URL?.trim() || deriveWsUrl(rpc);

  // ✅ THIS is the whole fix: force the WS endpoint into the Solana connection.
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

  _umi = umi;
  return umi;
}
