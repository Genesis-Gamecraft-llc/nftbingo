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

function buildLockKey(wallet: string) {
  return `buildLock:${wallet}`;
}

function now() {
  return new Date().toISOString();
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
 * Standard 5x5 bingo card:
 * B=1-15, I=16-30, N=31-45, G=46-60, O=61-75.
 * Returns 25-length array row-major, center=0 (FREE).
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

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    cols[c] = pool.slice(0, 5);
  }

  const out: number[] = new Array(25).fill(0);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      out[r * 5 + c] = cols[c][r];
    }
  }

  out[12] = 0;
  return out;
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
      return NextResponse.json({ ok: false, error: "Missing wallet" }, { status: 400 });
    }
    if (!quoteId) {
      return NextResponse.json({ ok: false, error: "Missing quoteId" }, { status: 400 });
    }

    // One build at a time per wallet
    const got = await kv.set(buildLockKey(wallet), "1", { nx: true, ex: 90 });
    if (!got) {
      return NextResponse.json(
        { ok: false, error: "A build is already in progress for this wallet. Wait and try again." },
        { status: 429 }
      );
    }
    lockAcquired = true;

    const quote = await kv.get<QuoteRecord>(quoteKey(quoteId));
    if (!quote) return NextResponse.json({ ok: false, error: "Quote not found" }, { status: 404 });
    if (Date.now() > quote.expiresAt) return NextResponse.json({ ok: false, error: "QUOTE_EXPIRED" }, { status: 400 });

    const umi = getUmiServer();

    // Reserve slot
    const slot = await reserveSlot(wallet);
    reservedSlotId = slot.slotId;

    const serial = slotSerial(slot.slotId);
    const tierLabel = "Platinum";
    const name = `${tierLabel} Tier #${serial}`;
    const symbol = "NFTBingo";

    const treasuryStr = process.env.TREASURY_WALLET?.trim();
    const collectionStr = process.env.FOUNDERS_COLLECTION_MINT?.trim();

    if (!treasuryStr) throw new Error("Missing TREASURY_WALLET env var");
    if (!collectionStr) throw new Error("Missing FOUNDERS_COLLECTION_MINT env var");

    const treasuryPk = publicKey(treasuryStr);
    const collectionMintPk = publicKey(collectionStr);

    // Numbers (deterministic)
    const numbers = generateBingoNumbers(`${slot.slotId}:${wallet}:${quoteId}`);

    // Remove freeSpace from numbersByLetter
    const { freeSpace, ...numbersByLetter } = bingoByLetter(numbers);

    // Generate image
    const pngBytes = await generateCardImage(numbers, slot.backgroundId);

    // Upload image to IRYS
    const imageFile = createGenericFile(pngBytes, `nftbingo-${serial}.png`, { contentType: "image/png" });
    const [imageUri] = await umi.uploader.upload([imageFile]);


    // Metadata JSON
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
        quoteId: quote.quoteId,
        numbersByLetter,
        generatedAt: Date.now(),
      },
    };

    // Upload metadata to IRYS
    const metadataUri = await umi.uploader.uploadJson(metadataJson);

    // Build tx: user pays + server mints + verify collection
    const mintSigner = generateSigner(umi);
    const ownerPk = publicKey(wallet);
    const userNoopSigner = createNoopSigner(ownerPk);

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
    const signedByServer = await builder.buildAndSign(umi);
    const txBytes = umi.transactions.serialize(signedByServer);
    const txBase64 = Buffer.from(txBytes).toString("base64");

    const attemptId = crypto.randomUUID();
    console.log(`[BUILD] ${now()} attemptId=${attemptId}`);

    // Store attempt: includes reveal payload, but NOT returned to client yet.
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
        createdAt: Date.now(),
      },
      { ex: 60 * 60 }
    );

    await kv.set(quoteKey(quoteId), { ...quote, wallet, attemptId }, { ex: 60 * 60 });

    console.log(`[BUILD] ${now()} success end`);

    // ✅ IMPORTANT: DO NOT reveal anything here.
    return NextResponse.json({
      ok: true,
      attemptId,
      quoteId,
      txBase64,
    });
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "UNKNOWN_ERROR";
    console.log(`[BUILD] ${now()} ERROR: ${message}`);
    if (err?.stack) console.log(err.stack);

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
