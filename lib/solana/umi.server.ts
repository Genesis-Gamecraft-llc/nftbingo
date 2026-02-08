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

let _umiFounders: ReturnType<typeof createUmi> | null = null;
let _umiPlayer: ReturnType<typeof createUmi> | null = null;

type AuthorityMode = "founders" | "player";

function loadKeypairFromEnv(mode: AuthorityMode): Keypair {
  // Founders uses existing env vars for backwards compatibility
  const jsonVar = mode === "player" ? "PLAYER_SOLANA_KEYPAIR_JSON" : "SOLANA_KEYPAIR_JSON";
  const pathVar = mode === "player" ? "PLAYER_SOLANA_KEYPAIR_PATH" : "SOLANA_KEYPAIR_PATH";

  const json = process.env[jsonVar]?.trim();
  if (json) {
    const secret = Uint8Array.from(JSON.parse(json));
    return Keypair.fromSecretKey(secret);
  }

  const p = process.env[pathVar]?.trim();
  if (p) {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    const raw = fs.readFileSync(abs, "utf8");
    const secret = Uint8Array.from(JSON.parse(raw));
    return Keypair.fromSecretKey(secret);
  }

  throw new Error(`Missing ${jsonVar} or ${pathVar}`);
}

function deriveWsUrl(httpUrl: string): string {
  if (httpUrl.startsWith("https://")) return "wss://" + httpUrl.slice("https://".length);
  if (httpUrl.startsWith("http://")) return "ws://" + httpUrl.slice("http://".length);
  return httpUrl;
}

function makeUmi(mode: AuthorityMode) {
  const rpc = process.env.SOLANA_RPC_URL?.trim();
  if (!rpc) throw new Error("Missing SOLANA_RPC_URL");

  const ws = process.env.SOLANA_WS_URL?.trim() || deriveWsUrl(rpc);

  const connection = new Connection(rpc, {
    commitment: "confirmed",
    wsEndpoint: ws,
  });

  const kp = loadKeypairFromEnv(mode);

  const umi = createUmi(connection)
    .use(mplToolbox())
    .use(mplTokenMetadata())
    // Keeping uploader is fine for Founders (server-paid uploads).
    // Player Series uses client-funded Irys uploads, but leaving this enabled doesn't cost you anything
    // unless you call uploader methods on the server.
    .use(
      irysUploader({
        address: process.env.IRYS_URL?.trim() || "https://node1.irys.xyz",
      })
    );

  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(kp.secretKey);
  umi.use(keypairIdentity(createSignerFromKeypair(umi, umiKeypair)));

  return umi;
}

/**
 * Founders authority Umi (existing behavior)
 */
export function getUmiServer() {
  if (_umiFounders) return _umiFounders;
  _umiFounders = makeUmi("founders");
  return _umiFounders;
}

/**
 * Player Series authority Umi (new, separate identity)
 */
export function getUmiPlayerServer() {
  if (_umiPlayer) return _umiPlayer;
  _umiPlayer = makeUmi("player");
  return _umiPlayer;
}
