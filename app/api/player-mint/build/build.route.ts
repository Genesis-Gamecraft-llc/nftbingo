import "server-only";

import crypto from "crypto";
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

import {
  createNoopSigner,
  createGenericFile,
  generateSigner,
  percentAmount,
  publicKey,
  transactionBuilder,
} from "@metaplex-foundation/umi";
import {
  createNft,
  findMasterEditionPda,
  findMetadataPda,
  verifyCollectionV1,
} from "@metaplex-foundation/mpl-token-metadata";

import { getUmiPlayerServer } from "@/lib/solana/umi.server";
import { generateCardImage } from "@/lib/cardGenerator/generateImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BuildRequest = {
  buildId: string;
  wallet: string;
  items: Array<{ index: number }>; // client only sends indexes; server generates/uploads
};

type PlayerInitRecord = {
  buildId: string;
  wallet: string;
  createdAt: number;
  expiresAt: number;
  count: number;
  items: Array<{
    index: number;
    serialNum: number;
    serialStr: string;
    backgroundId: number;
    numbers: number[];
  }>;
};

type AttemptRecord = {
  attemptId: string;
  buildId: string;
  wallet: string;
  createdAt: number;
  mints: Array<{
    index: number;
    serialStr: string;
    mint: string;
    imageUri: string;
    metadataUri: string;
    txBase64: string; // server-partially-signed tx (mint signer, collection verify)
  }>;
};

function buildKey(buildId: string) {
  return `player:build:${buildId}`;
}
function attemptKey(attemptId: string) {
  return `player:attempt:${attemptId}`;
}

function assertEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} env var`);
  return v;
}

function getSeriesFolder(): string {
  return process.env.PLAYER_SERIES_SERIES_FOLDER?.trim() || "player";
}

function bingoByLetter(numbers: number[]) {
  const col = (c: number) => [
    numbers[c],
    numbers[c + 5],
    numbers[c + 10],
    numbers[c + 15],
    numbers[c + 20],
  ];

  return {
    B: col(0),
    I: col(1),
    N: col(2),
    G: col(3),
    O: col(4),
    freeSpace: { row: 2, col: 2, value: numbers[12] },
  };
}

function buildPlayerMetadata(opts: {
  serialStr: string;
  backgroundId: number;
  numbers: number[];
  imageUri: string;
}) {
  const tierLabel = "Free";
  const name = `Player Series #${opts.serialStr}`;
  const symbol = process.env.PLAYER_SERIES_SYMBOL?.trim() || "NFTBingo";
  const { freeSpace, ...numbersByLetter } = bingoByLetter(opts.numbers);

  return {
    name,
    symbol,
    description: `NFTBingo Player Series - ${tierLabel} Tier #${opts.serialStr}`,
    image: opts.imageUri,
    attributes: [
      { trait_type: "Tier", value: tierLabel },
      { trait_type: "Serial", value: opts.serialStr },
      { trait_type: "Background", value: String(opts.backgroundId) },
    ],
    properties: {
      files: [{ uri: opts.imageUri, type: "image/png" }],
      category: "image",
    },
    nftbingo: {
      quoteId: `player-${opts.serialStr}`,
      numbersByLetter,
      generatedAt: Date.now(),
    },
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BuildRequest;

    const buildId = String(body.buildId || "").trim();
    const wallet = String(body.wallet || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!buildId || !wallet) {
      return NextResponse.json({ ok: false, error: "Missing buildId or wallet" }, { status: 400 });
    }

    // still enforce 1..5 for safety, even though init locks to 1
    if (items.length < 1 || items.length > 5) {
      return NextResponse.json({ ok: false, error: "items must be 1..5" }, { status: 400 });
    }

    const init = (await kv.get<PlayerInitRecord>(buildKey(buildId))) ?? null;
    if (!init) return NextResponse.json({ ok: false, error: "Build expired or not found" }, { status: 404 });
    if (init.wallet !== wallet) return NextResponse.json({ ok: false, error: "Wallet mismatch" }, { status: 403 });
    if (Date.now() > init.expiresAt) return NextResponse.json({ ok: false, error: "Build expired" }, { status: 410 });

    const byIndex = new Map(init.items.map((x) => [x.index, x]));

    // Validate indexes exist and are unique
    const seen = new Set<number>();
    for (const it of items) {
      const idx = Number(it.index);
      if (!Number.isFinite(idx)) {
        return NextResponse.json({ ok: false, error: "Invalid index" }, { status: 400 });
      }
      if (seen.has(idx)) {
        return NextResponse.json({ ok: false, error: `Duplicate index ${idx}` }, { status: 400 });
      }
      seen.add(idx);
      if (!byIndex.get(idx)) {
        return NextResponse.json({ ok: false, error: `Invalid index ${idx}` }, { status: 400 });
      }
    }

    const umi = getUmiPlayerServer();

    const collectionMintStr = assertEnv("PLAYER_SERIES_COLLECTION_MINT");
    const collectionMintPk = publicKey(collectionMintStr);

    const ownerPk = publicKey(wallet);
    const userNoopSigner = createNoopSigner(ownerPk);

    const attemptId = crypto.randomUUID();
    const mints: AttemptRecord["mints"] = [];

    const seriesFolder = getSeriesFolder();

    // ✅ Build ONE tx per mint to avoid tx-size failures
    for (const it of items) {
      const idx = Number(it.index);
      const expected = byIndex.get(idx)!;

      // 1) Generate image server-side
      const pngBytes = await generateCardImage(expected.numbers, expected.backgroundId, { seriesFolder });

      // 2) Upload image to Irys (server pays)
      const imageFile = createGenericFile(pngBytes, `player-${expected.serialStr}.png`, {
        contentType: "image/png",
      });
      const [imageUri] = await umi.uploader.upload([imageFile]);

      // 3) Upload metadata to Irys (server pays)
      const md = buildPlayerMetadata({
        serialStr: expected.serialStr,
        backgroundId: expected.backgroundId,
        numbers: expected.numbers,
        imageUri,
      });

      const mdBytes = new TextEncoder().encode(JSON.stringify(md));
      const mdFile = createGenericFile(mdBytes, `player-${expected.serialStr}.json`, {
        contentType: "application/json",
      });
      const [metadataUri] = await umi.uploader.upload([mdFile]);

      // 4) Build mint tx (user pays Solana fees)
      const mintSigner = generateSigner(umi);
      const name = `Player Series #${expected.serialStr}`;
      const symbol = process.env.PLAYER_SERIES_SYMBOL?.trim() || "NFTBingo";

      let builder = transactionBuilder();

      builder = builder.add(
        createNft(umi, {
          payer: userNoopSigner,
          mint: mintSigner,
          authority: umi.identity,
          name,
          symbol,
          uri: metadataUri,
          sellerFeeBasisPoints: percentAmount(0, 2),
          tokenOwner: ownerPk,
          collection: { key: collectionMintPk, verified: false },
        })
      );

      const metadataPda = findMetadataPda(umi, { mint: mintSigner.publicKey });
      const collectionMetadataPda = findMetadataPda(umi, { mint: collectionMintPk });
      const collectionMasterEditionPda = findMasterEditionPda(umi, { mint: collectionMintPk });

      builder = builder.add(
        verifyCollectionV1(umi, {
          metadata: metadataPda,
          collectionMint: collectionMintPk,
          authority: umi.identity,
          collectionMetadata: collectionMetadataPda,
          collectionMasterEdition: collectionMasterEditionPda,
        })
      );

      builder.setFeePayer(userNoopSigner);

      // server signs with mintSigner + collection authority; user still must sign as fee payer
      const signedByServer = await builder.buildAndSign(umi);
      const txBytes = umi.transactions.serialize(signedByServer);
      const txBase64 = Buffer.from(txBytes).toString("base64");

      mints.push({
        index: idx,
        serialStr: expected.serialStr,
        mint: mintSigner.publicKey.toString(),
        imageUri,
        metadataUri,
        txBase64,
      });
    }

    const attempt: AttemptRecord = {
      attemptId,
      buildId,
      wallet,
      createdAt: Date.now(),
      mints,
    };

    await kv.set(attemptKey(attemptId), attempt, { ex: 60 * 60 });

    return NextResponse.json({
      ok: true,
      attemptId,
      txs: mints.map(({ index, serialStr, mint, txBase64 }) => ({ index, serialStr, mint, txBase64 })),
      mints: mints.map(({ index, serialStr, mint, imageUri, metadataUri }) => ({ index, serialStr, mint, imageUri, metadataUri })),
      note: "Server paid Irys uploads. Client signs mint tx (Solana fees) then submit to /api/player-mint/submit.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Build error" }, { status: 500 });
  }
}
