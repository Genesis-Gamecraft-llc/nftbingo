export const runtime = "nodejs";

import nacl from "tweetnacl";
import { redis } from "@/lib/upstash";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function verifyDiscordRequest(opts: {
  publicKeyHex: string;
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
}) {
  const { publicKeyHex, signature, timestamp, rawBody } = opts;
  if (!signature || !timestamp) return false;

  const pk = Buffer.from(publicKeyHex.trim(), "hex"); // trim matters
  const sig = Buffer.from(signature, "hex");
  const msg = Buffer.from(timestamp + rawBody);

  return nacl.sign.detached.verify(msg, sig, pk);
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  // ✅ Record that *someone* hit this endpoint (even if signature fails)
  await redis.set("discord:interactions:last_hit", Date.now().toString());

  const publicKeyHex = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKeyHex) {
    await redis.set("discord:interactions:last_error", "Missing DISCORD_PUBLIC_KEY");
    return json({ error: "Missing DISCORD_PUBLIC_KEY" }, 500);
  }

  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  // Save some debug (safe) so we can see what Discord sent
  await redis.set(
    "discord:interactions:last_headers",
    JSON.stringify({
      hasSig: !!signature,
      hasTs: !!timestamp,
      ua: req.headers.get("user-agent"),
    })
  );

  const ok = verifyDiscordRequest({ publicKeyHex, signature, timestamp, rawBody });
  if (!ok) {
    await redis.set("discord:interactions:last_error", "Bad signature");
    return json({ error: "Bad signature" }, 401);
  }

  let interaction: any;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    await redis.set("discord:interactions:last_error", "Invalid JSON");
    return json({ error: "Invalid JSON" }, 400);
  }

  // ✅ Discord verification ping
  if (interaction?.type === 1) {
    await redis.set("discord:interactions:last_error", "");
    return json({ type: 1 });
  }

  await redis.set("discord:interactions:last_error", "");
  return json({ type: 4, data: { content: "Interactions endpoint is live ✅" } });
}

export async function GET() {
  return json({ ok: true });
}