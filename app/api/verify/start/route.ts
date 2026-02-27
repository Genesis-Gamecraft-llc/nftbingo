export const runtime = "nodejs";

import { redis } from "@/lib/upstash";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const state = typeof body?.state === "string" ? body.state : "";
    const wallet = typeof body?.wallet === "string" ? body.wallet : "";

    if (!state) return json({ error: "Missing state. Go back to Discord and run /verify again." }, 400);
    if (!wallet) return json({ error: "Missing wallet. Connect your wallet first." }, 400);

    const raw = await redis.get<string>(`verify:state:${state}`);
    if (!raw) return json({ error: "State expired. Go back to Discord and run /verify again." }, 400);

    const parsed = JSON.parse(raw) as { nonce: string; discordUserId: string };

    const message =
      `NFTBingo verification\n\n` +
      `Wallet: ${wallet}\n` +
      `Nonce: ${parsed.nonce}\n\n` +
      `Sign to verify ownership.`;

    return json({ ok: true, message });
  } catch (e: any) {
    return json({ error: e?.message || "Verify start failed." }, 500);
  }
}

export async function GET() {
  return json({ ok: true });
}