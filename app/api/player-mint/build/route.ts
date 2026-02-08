import "server-only";

import crypto from "crypto";
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

import {
  createNoopSigner,
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

import { getUmiServer } from "@/lib/solana/umi.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BuildRequest = {
  buildId: string;
  wallet: string;
  items: Array<{ index: number; imageUri: string; metadataUri: string }>;
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
    txBase64: string; // <-- store unsigned server-signed tx
  }>;
};

function buildKey(buildId: string) {
  return `player:build:${buildId}`;
}
function attemptKey(attemptId: string) {
  return `player:attempt:${attemptId}`;
}

async function fetchJson(uri: string) {
  const res = await fetch(uri, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch metadataUri: ${res.status}`);
  return res.json();
}

function assertEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} env var`);
  return v;
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

function normalizeNumbersByLetter(md: any) {
  const nbl = md?.nftbingo?.numbersByLetter;
  if (!nbl) return null;

  const letters = ["B", "I", "N", "G", "O"] as const;
  for (const L of letters) {
    if (!Array.isArray(nbl[L]) || nbl[L].length !== 5) return null;
  }

  return {
    B: nbl.B.map((x: any) => Number(x)),
    I: nbl.I.map((x: any) => Number(x)),
    N: nbl.N.map((x: any) => Number(x)),
    G: nbl.G.map((x: any) => Number(x)),
    O: nbl.O.map((x: any) => Number(x)),
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
    if (items.length < 1 || items.length > 5) {
      return NextResponse.json({ ok: false, error: "items must be 1..5" }, { status: 400 });
    }

    const init = (await kv.get<PlayerInitRecord>(buildKey(buildId))) ?? null;
    if (!init) return NextResponse.json({ ok: false, error: "Build expired or not found" }, { status: 404 });
    if (init.wallet !== wallet) return NextResponse.json({ ok: false, error: "Wallet mismatch" }, { status: 403 });
    if (Date.now() > init.expiresAt) return NextResponse.json({ ok: false, error: "Build expired" }, { status: 410 });

    const byIndex = new Map(init.items.map((x) => [x.index, x]));

    // Verify uploaded metadata matches what server generated
    for (const it of items) {
      const idx = Number(it.index);
      const expected = byIndex.get(idx);
      if (!expected) return NextResponse.json({ ok: false, error: `Invalid index ${idx}` }, { status: 400 });

      const md = await fetchJson(it.metadataUri);

      if (String(md?.image || "") !== String(it.imageUri || "")) {
        return NextResponse.json({ ok: false, error: `Metadata image mismatch at index ${idx}` }, { status: 400 });
      }

      const tierAttr = Array.isArray(md?.attributes) ? md.attributes.find((a: any) => a?.trait_type === "Tier") : null;
      if (String(tierAttr?.value || "") !== "Free") {
        return NextResponse.json({ ok: false, error: `Tier must be Free at index ${idx}` }, { status: 400 });
      }

      const serialAttr = Array.isArray(md?.attributes) ? md.attributes.find((a: any) => a?.trait_type === "Serial") : null;
      if (String(serialAttr?.value || "") !== expected.serialStr) {
        return NextResponse.json({ ok: false, error: `Serial mismatch at index ${idx}` }, { status: 400 });
      }

      const got = normalizeNumbersByLetter(md);
      if (!got) return NextResponse.json({ ok: false, error: `Missing/invalid numbersByLetter at index ${idx}` }, { status: 400 });

      const { freeSpace, ...expectedByLetter } = bingoByLetter(expected.numbers);
      for (const L of ["B", "I", "N", "G", "O"] as const) {
        for (let k = 0; k < 5; k++) {
          if (Number(got[L][k]) !== Number((expectedByLetter as any)[L][k])) {
            return NextResponse.json({ ok: false, error: `numbersByLetter mismatch at ${L}[${k}] index ${idx}` }, { status: 400 });
          }
        }
      }
    }

    const umi = getUmiServer();
    const collectionMintStr = assertEnv("PLAYER_SERIES_COLLECTION_MINT");
    const collectionMintPk = publicKey(collectionMintStr);

    const ownerPk = publicKey(wallet);
    const userNoopSigner = createNoopSigner(ownerPk);

    const attemptId = crypto.randomUUID();
    const mints: AttemptRecord["mints"] = [];

    // ✅ Build ONE tx per mint to avoid tx-size failures
    for (const it of items) {
      const idx = Number(it.index);
      const expected = byIndex.get(idx)!;

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
          uri: it.metadataUri,
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

      const signedByServer = await builder.buildAndSign(umi);
      const txBytes = umi.transactions.serialize(signedByServer);
      const txBase64 = Buffer.from(txBytes).toString("base64");

      mints.push({
        index: idx,
        serialStr: expected.serialStr,
        mint: mintSigner.publicKey.toString(),
        imageUri: it.imageUri,
        metadataUri: it.metadataUri,
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
      note: "Client signs each tx (prefer signAllTransactions) then submit array to /api/player-mint/submit.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Build error" }, { status: 500 });
  }
}
