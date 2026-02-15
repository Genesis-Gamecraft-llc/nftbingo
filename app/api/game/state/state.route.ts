import { NextResponse } from "next/server";
import { loadState } from "../_store";
import { buildStateResponse } from "../_stateResponse";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet") || undefined;

  const state = await loadState();
  const payload = await buildStateResponse(state, wallet);

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
