import { NextResponse } from "next/server";
import { loadState } from "../_store";
import { buildStateResponse } from "../_stateResponse";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet") || undefined;

  const state = await loadState();
  const out = await buildStateResponse(state, wallet || undefined);

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
