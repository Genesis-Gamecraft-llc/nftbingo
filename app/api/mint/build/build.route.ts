// app/api/mint/build/route.ts
import "server-only";

import crypto from "crypto";
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

import {
  createGenericFile,
  createNoopSigner,
  generateSigner,
  lamports,
  percentAmount,
  publicKey,
} from "@metaplex-foundation/umi";

import { transferSol } from "@metaplex-foundation/mpl-toolbox";
import {
  createNft,
  findMasterEditionPda,
  findMetadataPda,
  verifyCollectionV1,
} from "@metaplex-foundation/mpl-token-metadata";

import { getUmiServer } from "@/lib/solana/umi.server";
import { reserveSlot, releaseSlot, slotSerial } from "@/lib/mint/slots.server";
import { generateCardImage } from "@/lib/cardGenerator/generateImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QuoteRecord = {
  quoteId: string;
  tier: string;
  usdTarget: number;
  solUsdPriceUsed: number;
  priceLamports: string;
  issuedAt: number;
  expiresAt: number;
  validForSeconds: number;
  wallet?: string;
  attemptId?: string;
};

function quoteKey(id: string) {
  return `quote:${id}`;
}

/**
 * Deterministic RNG (mulberry32) seeded from a u32.
 */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Produce a standard 5x5 bingo card:
 * B=1-15, I=16-30, N=31-45, G=46-60, O=61-75.
 * Returns a 25-length array in row-major order.
 * Center index 12 is set to 0 (FREE).
 */
function generateBingoNumbers(seedString: string): number[] {
  const hash = crypto.createHash("sha256").update(seedString).digest();
  const seed = hash.readUInt32LE(0);
  const rand = mulberry32(seed);

  const ranges = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75],
  ] as const;

  const cols: number[][] = [];
  for (let c = 0; c < 5; c++) {
    const [min, max] = ranges[c];
    const pool: number[] = [];
    for (let n = min; n <= max; n++) pool.push(n);

    // shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    cols[c] = pool.slice(0, 5);
  }

  // convert col-major to row-major 5x5
  const out: number[] = new Array(25).fill(0);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      out[r * 5 + c] = cols[c][r];
    }
  }

  out[12] = 0; // FREE space
  return out;
}

/**
 * Convert row-major numbers[] into letter columns for metadata readability.
 */
function bingoByLetter(numbers: number[]) {
  if (!Array.isArray(numbers) || numbers.length !== 25) {
    throw new Error("numbers must be length 25");
  }

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

function buildLockKey(wallet: string) {
  return `buildLock:${wallet}`;
}

function now() {
  return new Date().toISOString();
}

export async function POST(req: Request) {
  let reservedSlotId: number | null = null;
  let walletForLock = "";
  let lockAcquired = false;

  try {
    console.log(`[BUILD] ${now()} start`);

    const body = await req.json().catch(() => ({}));
    const wallet = String(body?.wallet || "").trim();
    const quoteId = String(body?.quoteId || "").trim();
    walletForLock = wallet;

    console.log(`[BUILD] ${now()} input wallet=${wallet || "(missing)"} quoteId=${quoteId || "(missing)"}`);

    if (!wallet) {
      console.log(`[BUILD] ${now()} abort missing wallet`);
      return NextResponse.json({ ok: false, error: "Missing wallet" }, { status: 400 });
    }
    if (!quoteId) {
      console.log(`[BUILD] ${now()} abort missing quoteId`);
      return NextResponse.json({ ok: false, error: "Missing quoteId" }, { status: 400 });
    }

    // HARDEN: one build at a time per wallet to stop CU-burning storms / parallel tabs
    console.log(`[BUILD] ${now()} acquiring build lock ${buildLockKey(wallet)}`);
    const got = await kv.set(buildLockKey(wallet), "1", { nx: true, ex: 90 });
    if (!got) {
      console.log(`[BUILD] ${now()} lock denied for wallet=${wallet}`);
      return NextResponse.json(
        { ok: false, error: "A build is already in progress for this wallet. Wait for it to finish, then try again." },
        { status: 429 }
      );
    }
    lockAcquired = true;
    console.log(`[BUILD] ${now()} build lock acquired`);

    console.log(`[BUILD] ${now()} loading quote`);
    const quote = await kv.get<QuoteRecord>(quoteKey(quoteId));
    if (!quote) {
      console.log(`[BUILD] ${now()} quote not found`);
      return NextResponse.json({ ok: false, error: "Quote not found" }, { status: 404 });
    }

    if (Date.now() > quote.expiresAt) {
      console.log(`[BUILD] ${now()} quote expired`);
      return NextResponse.json({ ok: false, error: "QUOTE_EXPIRED" }, { status: 400 });
    }

    console.log(`[BUILD] ${now()} getUmiServer()`);
    const umi = getUmiServer();
    console.log(`[BUILD] ${now()} umi ready`);

    // Reserve slot
    console.log(`[BUILD] ${now()} reserveSlot(wallet=${wallet})`);
    const slot = await reserveSlot(wallet);
    reservedSlotId = slot.slotId;
    console.log(`[BUILD] ${now()} reserved slotId=${slot.slotId} backgroundId=${slot.backgroundId}`);

    const serial = slotSerial(slot.slotId);
    console.log(`[BUILD] ${now()} serial=${serial}`);

    // Platinum-only build route
    const tierLabel = "Platinum";
    const name = `${tierLabel} Tier #${serial}`;
    const symbol = "NFTBingo";

    const treasuryStr = process.env.TREASURY_WALLET?.trim();
    const collectionStr = process.env.FOUNDERS_COLLECTION_MINT?.trim();

    if (!treasuryStr) throw new Error("Missing TREASURY_WALLET env var");
    if (!collectionStr) throw new Error("Missing FOUNDERS_COLLECTION_MINT env var");

    const treasuryPk = publicKey(treasuryStr);
    const collectionMintPk = publicKey(collectionStr);

    // numbers
    console.log(`[BUILD] ${now()} generate numbers`);
    const numbers = generateBingoNumbers(`${slot.slotId}:${wallet}:${quoteId}`);
    const { freeSpace, ...numbersByLetter } = bingoByLetter(numbers);

    // image render
    console.log(`[BUILD] ${now()} generateCardImage start`);
    const pngBytes = await generateCardImage(numbers, slot.backgroundId, {
      seriesFolder: "series1",
    });
    console.log(`[BUILD] ${now()} generateCardImage done bytes=${pngBytes?.length ?? 0}`);

    const imageFile = createGenericFile(pngBytes, `platinum-${serial}.png`, {
      contentType: "image/png",
    });

    // ---- THIS IS THE MOST LIKELY SPAM SOURCE ----
    console.log(`[BUILD] ${now()} umi.uploader.upload(image) start`);
    const [imageUri] = await umi.uploader.upload([imageFile]);
    console.log(`[BUILD] ${now()} umi.uploader.upload(image) done imageUri=${imageUri}`);

    // metadata json
    console.log(`[BUILD] ${now()} build metadata json`);
    const metadataJson = {
      name,
      symbol,
      description: `NFTBingo Founders Series - ${tierLabel} Tier #${serial}`,
      image: imageUri,
      attributes: [
        { trait_type: "Tier", value: tierLabel },
        { trait_type: "Serial", value: serial },
        { trait_type: "Background", value: String(slot.backgroundId) },
      ],
      properties: {
        files: [{ uri: imageUri, type: "image/png" }],
        category: "image",
      },
      nftbingo: {
        tier: tierLabel.toLowerCase(),
        serial,
        backgroundId: slot.backgroundId,
        quoteId: quote.quoteId,
        numbersByLetter,
        generatedAt: Date.now(),
      },
    };

    console.log(`[BUILD] ${now()} umi.uploader.uploadJson(metadata) start`);
    const metadataUri = await umi.uploader.uploadJson(metadataJson);
    console.log(`[BUILD] ${now()} umi.uploader.uploadJson(metadata) done metadataUri=${metadataUri}`);

    // Build unsigned-for-user tx
    console.log(`[BUILD] ${now()} build tx start`);
    const ownerPk = publicKey(wallet);
    const userNoopSigner = createNoopSigner(ownerPk);
    const mintSigner = generateSigner(umi);

    const payIx = transferSol(umi, {
      source: userNoopSigner,
      destination: treasuryPk,
      amount: lamports(BigInt(quote.priceLamports)),
    });

    const createIx = createNft(umi, {
      mint: mintSigner,
      authority: umi.identity,
      name,
      symbol,
      uri: metadataUri,
      sellerFeeBasisPoints: percentAmount(5, 2),
      tokenOwner: ownerPk,
      collection: { key: collectionMintPk, verified: false },
    });

    const metadataPda = findMetadataPda(umi, { mint: mintSigner.publicKey });
    const collectionMetadataPda = findMetadataPda(umi, { mint: collectionMintPk });
    const collectionMasterEditionPda = findMasterEditionPda(umi, { mint: collectionMintPk });

    const verifyIx = verifyCollectionV1(umi, {
      metadata: metadataPda,
      collectionMint: collectionMintPk,
      authority: umi.identity,
      collectionMetadata: collectionMetadataPda,
      collectionMasterEdition: collectionMasterEditionPda,
    });

    const builder = payIx.add(createIx).add(verifyIx);

    console.log(`[BUILD] ${now()} builder.buildAndSign start`);
    const signedByServer = await builder.buildAndSign(umi);
    console.log(`[BUILD] ${now()} builder.buildAndSign done`);

    const txBytes = umi.transactions.serialize(signedByServer);
    const txBase64 = Buffer.from(txBytes).toString("base64");
    console.log(`[BUILD] ${now()} tx serialized bytes=${txBytes.length}`);

    const attemptId = crypto.randomUUID();
    console.log(`[BUILD] ${now()} attemptId=${attemptId}`);

    await kv.set(
      `attempt:${attemptId}`,
      {
        attemptId,
        quoteId,
        slotId: slot.slotId,
        serial,
        backgroundId: slot.backgroundId,
        name,
        metadataUri,
        imageUri,
        numbers,
        createdAt: Date.now(),
      },
      { ex: 60 * 60 }
    );

    await kv.set(quoteKey(quoteId), { ...quote, wallet, attemptId }, { ex: 60 * 60 });

    console.log(`[BUILD] ${now()} success end`);

    return NextResponse.json({
      ok: true,
      attemptId,
      quoteId,
      slotId: slot.slotId,
      serial,
      backgroundId: slot.backgroundId,
      name,
      metadataUri,
      imageUri,
      txBase64,
    });
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "UNKNOWN_ERROR";
    console.log(`[BUILD] ${now()} ERROR: ${message}`);
    if (err?.stack) console.log(err.stack);

    // If we reserved a slot but failed before mint finalized, release it.
    if (reservedSlotId != null) {
      console.log(`[BUILD] ${now()} releasing reserved slotId=${reservedSlotId}`);
      try {
        await releaseSlot(reservedSlotId);
        console.log(`[BUILD] ${now()} released slotId=${reservedSlotId}`);
      } catch (e: any) {
        console.log(`[BUILD] ${now()} failed to release slotId=${reservedSlotId}: ${String(e?.message ?? e)}`);
      }
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    if (lockAcquired && walletForLock) {
      try {
        await kv.del(buildLockKey(walletForLock));
        console.log(`[BUILD] ${now()} build lock released wallet=${walletForLock}`);
      } catch (e: any) {
        console.log(`[BUILD] ${now()} failed to release build lock wallet=${walletForLock}: ${String(e?.message ?? e)}`);
      }
    }
  }
}
