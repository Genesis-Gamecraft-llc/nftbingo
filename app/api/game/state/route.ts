import { NextResponse } from "next/server";
import { loadState, derivePots } from "../_store";

export const runtime = "nodejs";

export async function GET() {
  const state = await loadState();
  const pots = derivePots(state);

  return NextResponse.json({
    ok: true,
    state,
    ...pots,
  });
}
