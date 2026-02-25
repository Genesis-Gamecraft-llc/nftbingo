export const runtime = "nodejs";

import nacl from "tweetnacl";
import { createVerifyState, checkCooldown, getLinked } from "@/lib/verify-store";

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

  const pk = Buffer.from(publicKeyHex.trim(), "hex");
  const sig = Buffer.from(signature, "hex");
  const msg = Buffer.from(timestamp + rawBody);

  return nacl.sign.detached.verify(msg, sig, pk);
}

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const VERIFY_CHANNEL = () => must("DISCORD_VERIFY_CHANNEL_ID");

export async function POST(req: Request) {
  const publicKeyHex = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKeyHex) return json({ error: "Missing DISCORD_PUBLIC_KEY" }, 500);

  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const rawBody = await req.text();

  const ok = verifyDiscordRequest({ publicKeyHex, signature, timestamp, rawBody });
  if (!ok) return json({ error: "Bad signature" }, 401);

  let interaction: any;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // PING
  if (interaction?.type === 1) return json({ type: 1 });

  const name = interaction?.data?.name as string | undefined;
  const userId = interaction?.member?.user?.id || interaction?.user?.id;
  const channelId = interaction?.channel_id;

  // Only allow /verify + /refresh in your verify channel
  if ((name === "verify" || name === "refresh") && channelId !== VERIFY_CHANNEL()) {
    return json({
      type: 4,
      data: {
        flags: 64, // ephemeral
        content: `Run this in <#${VERIFY_CHANNEL()}>.`,
      },
    });
  }

  // 5-minute cooldown per user
  if (userId && (name === "verify" || name === "refresh")) {
    const allowed = await checkCooldown(userId, 5 * 60);
    if (!allowed) {
      return json({
        type: 4,
        data: { flags: 64, content: "Cooldown: try again in a few minutes." },
      });
    }
  }

  if (name === "verify") {
    const { state } = await createVerifyState(userId);
    const url = `https://nftbingo.net/verify?state=${encodeURIComponent(state)}`;

    return json({
      type: 4,
      data: {
        flags: 64,
        content: "Click to verify your wallet:",
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: "Verify Wallet",
                url,
              },
            ],
          },
        ],
      },
    });
  }

  if (name === "refresh") {
    const linked = await getLinked(userId);
    if (!linked) {
      return json({
        type: 4,
        data: { flags: 64, content: "You’re not linked yet. Use /verify first." },
      });
    }

    // We do the refresh work on your API route (same logic as verify complete)
    const url = `https://nftbingo.net/verify?state=${encodeURIComponent((await createVerifyState(userId)).state)}`;
    return json({
      type: 4,
      data: {
        flags: 64,
        content: "Re-verify to refresh your roles (quick sign):",
        components: [
          {
            type: 1,
            components: [
              { type: 2, style: 5, label: "Refresh Roles", url },
            ],
          },
        ],
      },
    });
  }

  return json({
    type: 4,
    data: { flags: 64, content: "Unhandled command." },
  });
}

export async function GET() {
  return json({ ok: true });
}