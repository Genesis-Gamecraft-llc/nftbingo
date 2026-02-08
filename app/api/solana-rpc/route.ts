import "server-only";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rpc = process.env.SOLANA_RPC_URL?.trim();
  if (!rpc) return NextResponse.json({ error: "Missing SOLANA_RPC_URL" }, { status: 500 });

  const body = await req.text();

  const upstream = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store",
  });

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
    },
  });
}
