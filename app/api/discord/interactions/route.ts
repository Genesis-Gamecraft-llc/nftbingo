import nacl from "tweetnacl";

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

  const pk = Buffer.from(publicKeyHex, "hex");
  const sig = Buffer.from(signature, "hex");
  const msg = Buffer.from(timestamp + rawBody);

  return nacl.sign.detached.verify(msg, sig, pk);
}

export async function POST(req: Request) {
  const publicKeyHex = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKeyHex) return json({ error: "Missing DISCORD_PUBLIC_KEY" }, 500);

  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  const rawBody = await req.text();

  // Verify signature (required for real security; also safe during endpoint verification)
  const ok = verifyDiscordRequest({ publicKeyHex, signature, timestamp, rawBody });
  if (!ok) return json({ error: "Bad signature" }, 401);

  const interaction = JSON.parse(rawBody);

  // Discord endpoint verification sends a PING (type 1). Must respond with { type: 1 }.
  if (interaction?.type === 1) {
    return json({ type: 1 });
  }

  // Temporary stub for now so Discord sees a valid response.
  return json({
    type: 4,
    data: { content: "Interactions endpoint is live ✅" },
  });
}

// Optional: make sure GET doesn't break anything if you visit it in browser.
export async function GET() {
  return json({ ok: true });
}