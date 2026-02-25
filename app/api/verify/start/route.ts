export const runtime = "nodejs";

import { redis } from "@/lib/upstash";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// This endpoint returns the exact message to sign for the given state.
// We do NOT create state here (Discord already created it).
export async function POST(req: Request) {
  const { state, wallet } = await req.json().catch(() => ({}));

  if (!state || typeof state !== "string") return json({ error: "Missing state" }, 400);
  if (!wallet || typeof wallet !== "string") return json({ error: "Missing wallet" }, 400);

  const raw = await redis.get<string>(`verify:state:${state}`);
  if (!raw) return json({ error: "State expired. Run /verify again in Discord." }, 400);

  const parsed = JSON.parse(raw) as { nonce: string; discordUserId: string };
  const message = `NFTBingo verification\n\nWallet: ${wallet}\nNonce: ${parsed.nonce}\n\nSign to verify ownership.`;

  return json({ message });
}