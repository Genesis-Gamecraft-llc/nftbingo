// app/api/solana/mint-card/route.ts
import "server-only";

import fs from "fs";
import path from "path";
import bs58 from "bs58";
import { NextResponse } from "next/server";

import { create } from "@metaplex-foundation/mpl-core";
import { createGenericFile, generateSigner } from "@metaplex-foundation/umi";

import { getUmiServer } from "@/lib/solana/umi.server";
import { generateCardImage } from "@/lib/cardGenerator/generateImage";

type MintRequest = {
  name?: string;
  description?: string;

  // Optional: keep for internal/testing, but UI won't send it
  backgroundPath?: string;

  cardId?: number;
  attributes?: Array<{ trait_type: string; value: string | number }>;
};

const FOUNDERS_BG_COUNT = 50;

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function safeResolvePublicBackground(rel: string) {
  const cleaned = rel.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!cleaned.startsWith("backgrounds/")) throw new Error("backgroundPath must start with 'backgrounds/'.");
  if (cleaned.includes("..")) throw new Error("Invalid backgroundPath.");
  return path.join(process.cwd(), "public", cleaned);
}

function pickFoundersBackgroundPath(): { path: string; id: number; fellBack: boolean } {
  const id = randInt(0, FOUNDERS_BG_COUNT - 1);
  const candidate = `backgrounds/series1/bg${id}.png`;

  const abs = safeResolvePublicBackground(candidate);
  if (fs.existsSync(abs)) return { path: candidate, id, fellBack: false };

  // fallback to bg0
  return { path: "backgrounds/series1/bg0.png", id: 0, fellBack: true };
}

// --- Bingo number generation (standard rules) ---
function pickUnique(min: number, max: number, count: number): number[] {
  const chosen = new Set<number>();
  while (chosen.size < count) chosen.add(randInt(min, max));
  return Array.from(chosen);
}
function generateBingoGridRowMajor25() {
  const B = pickUnique(1, 15, 5);
  const I = pickUnique(16, 30, 5);
  const N = pickUnique(31, 45, 5);
  const G = pickUnique(46, 60, 5);
  const O = pickUnique(61, 75, 5);

  // FREE center
  N[2] = 0;

  const numbers: number[] = [];
  for (let row = 0; row < 5; row++) {
    numbers.push(B[row], I[row], N[row], G[row], O[row]);
  }

  const nonZero = numbers.filter((n) => n !== 0);
  const set = new Set(nonZero);
  if (set.size !== nonZero.length) throw new Error("Internal error: duplicate bingo numbers generated");

  return { numbers, columns: { B, I, N, G, O } };
}

function colTrait(label: "B" | "I" | "N" | "G" | "O", values: number[]) {
  const pretty = values.map((v) => (v === 0 ? "FREE" : String(v))).join(", ");
  return { trait_type: label, value: pretty };
}

function parseBgIdFromPath(backgroundRel: string) {
  const m = backgroundRel.match(/bg(\d+)\.png$/i);
  return m ? Number(m[1]) : 0;
}

export async function POST(req: Request) {
  try {
    const umi = getUmiServer();
    const body = (await req.json().catch(() => ({}))) as MintRequest;

    // Server decides the background (unless you explicitly pass one for internal testing)
    let chosen = pickFoundersBackgroundPath();

    if (body.backgroundPath) {
      // internal/testing override, still safe+validated
      const abs = safeResolvePublicBackground(body.backgroundPath);
      if (fs.existsSync(abs)) {
        chosen = {
          path: body.backgroundPath.replaceAll("\\", "/").replace(/^\/+/, ""),
          id: parseBgIdFromPath(body.backgroundPath),
          fellBack: false,
        };
      } else {
        // if they pass a bad path, still mint with fallback bg0
        chosen = { path: "backgrounds/series1/bg0.png", id: 0, fellBack: true };
      }
    }

    // Generate numbers + render final card image
    const { numbers, columns } = generateBingoGridRowMajor25();
    const backgroundId = parseBgIdFromPath(chosen.path);

    const pngBuffer = await generateCardImage(numbers, backgroundId);

    // Upload generated PNG to Arweave (via Irys)
    const fileName = `nftbingo-founders-devnet-${Date.now()}-bg${backgroundId}.png`;
    const imageFile = createGenericFile(pngBuffer, fileName, { contentType: "image/png" });
    const [imageUri] = await umi.uploader.upload([imageFile]);

    // Metadata
    const name = body.name ?? "NFTBingo Founders (Devnet Test)";
    const description =
      body.description ??
      "Founders Series devnet test mint. Background randomly selected. Image + metadata stored permanently on Arweave. Card numbers follow standard bingo rules.";

    const baseAttributes: Array<{ trait_type: string; value: string | number }> = [
      { trait_type: "Project", value: "NFTBingo" },
      { trait_type: "Series", value: "Series 1" },
      { trait_type: "Edition", value: "Founders Series" },

      { trait_type: "Background", value: chosen.path },
      { trait_type: "Encoding", value: "row-major-25" },
      { trait_type: "Free Index", value: 12 },

      colTrait("B", columns.B),
      colTrait("I", columns.I),
      colTrait("N", columns.N),
      colTrait("G", columns.G),
      colTrait("O", columns.O),
    ];

    if (typeof body.cardId === "number") baseAttributes.push({ trait_type: "Card ID", value: body.cardId });

    const metadataUri = await umi.uploader.uploadJson({
      name,
      description,
      image: imageUri,
      attributes: [...baseAttributes, ...(body.attributes ?? [])],
      properties: {
        category: "image",
        files: [{ uri: imageUri, type: "image/png" }],
        nftbingo: {
          version: 1,
          edition: "Founders Series",
          encoding: "row-major-25",
          freeIndex: 12,
          backgroundPath: chosen.path,
          numbers,
          columns,
        },
      },
    });

    // Mint Core Asset
    const assetSigner = generateSigner(umi);
    const result = await create(umi, {
      asset: assetSigner,
      name,
      uri: metadataUri,
    }).sendAndConfirm(umi);

    const sig58 = bs58.encode(result.signature);

    return NextResponse.json({
      ok: true,
      assetAddress: assetSigner.publicKey.toString(),
      metadataUri,
      imageUri,
      signature: sig58,
      numbers,
      columns,
      chosenBackgroundPath: chosen.path,
      chosenBackgroundId: chosen.id,
      backgroundFallbackUsed: chosen.fellBack,
      explorer: {
        asset: `https://explorer.solana.com/address/${assetSigner.publicKey.toString()}?cluster=devnet`,
        tx: `https://explorer.solana.com/tx/${sig58}?cluster=devnet`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
