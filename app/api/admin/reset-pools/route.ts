import "server-only";
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "");

  if (process.env.ADMIN_RESET_TOKEN && token !== process.env.ADMIN_RESET_TOKEN) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  await kv.del("founders:bgPool");
  await kv.del("founders:nextHint");

  return NextResponse.json({ ok: true });
}
