// app/api/mint/quote/route.ts
import crypto from "crypto";
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USD_TARGET = 125;

// Pyth SOL/USD feed id
const PYTH_SOL_USD_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

const HERMES_URL = process.env.PYTH_HERMES_URL ?? "https://hermes.pyth.network";

function roundUpLamports(sol: number): bigint {
  const lamports = sol * 1_000_000_000;
  return BigInt(Math.ceil(lamports));
}

async function getCachedSolUsd(): Promise<number> {
  const cacheKey = "oracle:solusd";
  const now = Date.now();

  const cached = (await kv.get<{ price: number; ts: number }>(cacheKey)) ?? null;
  if (cached && now - cached.ts <= 60_000) return cached.price;

  const url = new URL("/v2/updates/price/latest", HERMES_URL);
  url.searchParams.append("ids[]", PYTH_SOL_USD_FEED_ID);
  url.searchParams.set("parsed", "true");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Hermes price fetch failed: ${res.status}`);

  const data = await res.json();
  const parsed = data?.parsed?.[0]?.price ?? data?.parsed?.[0] ?? null;

  const price = parsed?.price;
  const expo = parsed?.expo;

  if (typeof price !== "string" && typeof price !== "number") {
    throw new Error("Unexpected Hermes response: missing price");
  }
  if (typeof expo !== "number") {
    throw new Error("Unexpected Hermes response: missing expo");
  }

  const p = Number(price) * Math.pow(10, expo);
  if (!Number.isFinite(p) || p <= 0) throw new Error("Invalid SOL/USD price");

  await kv.set(cacheKey, { price: p, ts: now }, { ex: 120 });
  return p;
}

export async function GET(req: Request) {
  try {
    const paused = (await kv.get<boolean>("mintPaused")) ?? false;
    if (paused) {
      return NextResponse.json({ ok: false, error: "Mint is paused." }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    const tier = (searchParams.get("tier") ?? "platinum").toLowerCase();

    if (!wallet) {
      return NextResponse.json({ ok: false, error: "Missing wallet" }, { status: 400 });
    }
    if (tier !== "platinum") {
      return NextResponse.json({ ok: false, error: "Only platinum supported right now" }, { status: 400 });
    }

    // One active quote per wallet
    const activeKey = `activeQuote:${wallet}`;
    const prevQuoteId = await kv.get<string>(activeKey);
    if (prevQuoteId) await kv.del(`quote:${prevQuoteId}`);

    const solUsd = await getCachedSolUsd();
    const priceSol = USD_TARGET / solUsd;
    const priceLamports = roundUpLamports(priceSol);

    const quoteId = crypto.randomUUID();
    const issuedAt = Date.now();
    const expiresAt = issuedAt + 5 * 60_000;

    await kv.set(
      `quote:${quoteId}`,
      {
        quoteId,
        wallet,
        tier,
        usdTarget: USD_TARGET,
        solUsdPriceUsed: solUsd,
        priceLamports: priceLamports.toString(),
        issuedAt,
        expiresAt,
        used: false,
      },
      { ex: 5 * 60 }
    );

    await kv.set(activeKey, quoteId, { ex: 5 * 60 });

    return NextResponse.json({
      ok: true,
      quoteId,
      tier,
      usdTarget: USD_TARGET,
      solUsdPriceUsed: solUsd,
      priceLamports: priceLamports.toString(),
      priceSol: (Number(priceLamports) / 1_000_000_000).toString(),
      issuedAt,
      expiresAt,
      validForSeconds: 300,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Quote error" }, { status: 500 });
  }
}
