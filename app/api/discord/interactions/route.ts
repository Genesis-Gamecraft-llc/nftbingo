// app/api/discord/interactions/route.ts
export const runtime = "nodejs";

import nacl from "tweetnacl";
import { createVerifyState } from "@/lib/verify-store";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function getEnv(name: string) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : "";
}

const VERIFY_CHANNEL_ID = () => getEnv("DISCORD_VERIFY_CHANNEL_ID");
const APP_ORIGIN = () => getEnv("APP_ORIGIN") || "https://nftbingo.net";

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

function discordEphemeral(content: string, components?: any[]) {
  return json({
    type: 4,
    data: {
      flags: 64,
      content,
      ...(components ? { components } : {}),
    },
  });
}

function buildVerifyUrls(state: string) {
  const base = `${APP_ORIGIN().replace(/\/$/, "")}/verify?state=${encodeURIComponent(state)}`;
  const encoded = encodeURIComponent(base);

  return {
    base,
    phantom: `https://phantom.app/ul/browse/${encoded}`,
    solflare: `https://solflare.com/ul/v1/browse/${encoded}`,
  };
}

export async function POST(req: Request) {
  try {
    const publicKeyHex = getEnv("DISCORD_PUBLIC_KEY");
    if (!publicKeyHex) {
      return discordEphemeral("Server misconfigured: missing DISCORD_PUBLIC_KEY.");
    }

    const signature = req.headers.get("x-signature-ed25519");
    const timestamp = req.headers.get("x-signature-timestamp");
    const rawBody = await req.text();

    const ok = verifyDiscordRequest({
      publicKeyHex,
      signature,
      timestamp,
      rawBody,
    });

    if (!ok) {
      return json({ error: "Bad signature" }, 401);
    }

    const interaction = JSON.parse(rawBody);

    // Discord ping
    if (interaction.type === 1) {
      return json({ type: 1 });
    }

    const channelId = interaction.channel_id;
    const verifyChannelId = VERIFY_CHANNEL_ID();

    // Only allow in verify channel
    if (verifyChannelId && channelId !== verifyChannelId) {
      return discordEphemeral(`Run this in <#${verifyChannelId}>.`);
    }

    // Button click OR slash command
    if (
      (interaction.type === 3 &&
        interaction.data?.custom_id === "start_verify_button") ||
      interaction.data?.name === "verify"
    ) {
      const userId =
        interaction.member?.user?.id || interaction.user?.id;

      const { state } = await createVerifyState(userId);
      const { base, phantom, solflare } = buildVerifyUrls(state);

      return discordEphemeral("Click below to verify your wallet:", [
        {
          type: 1,
          components: [
            { type: 2, style: 5, label: "Open Verification", url: base },
            { type: 2, style: 5, label: "Open in Phantom", url: phantom },
            { type: 2, style: 5, label: "Open in Solflare", url: solflare },
          ],
        },
      ]);
    }

    return discordEphemeral("Unhandled interaction.");
  } catch (e: any) {
    return discordEphemeral(`Error: ${e?.message || "Unknown error"}`);
  }
}

export async function GET() {
  return json({ ok: true });
}