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

function mobileTipText() {
  return "📱 Mobile tip: If the verify page can’t connect your wallet from Discord, tap ⋯ and choose **Open in Browser**.";
}

function buildVerifyUrl(state: string) {
  return `${APP_ORIGIN().replace(/\/$/, "")}/verify?state=${encodeURIComponent(state)}`;
}

// Prevent Redis/Upstash stalls from causing Discord timeouts.
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: any;
  const timeout = new Promise<T>((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    try {
      clearTimeout(t);
    } catch {}
  }
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
    const isVerifyButton =
      interaction.type === 3 && interaction.data?.custom_id === "start_verify_button";
    const isVerifySlash = interaction.data?.name === "verify";

    if (isVerifyButton || isVerifySlash) {
      const userId = interaction.member?.user?.id || interaction.user?.id;

      let state: string;
      try {
        ({ state } = await withTimeout(createVerifyState(userId), 1200, "createVerifyState"));
      } catch {
        return discordEphemeral(
          `Verification backend is busy right now. Try again in a moment.\n${mobileTipText()}`
        );
      }

      const url = buildVerifyUrl(state);

      return discordEphemeral(`Click below to verify your wallet:\n${mobileTipText()}`, [
        {
          type: 1,
          components: [{ type: 2, style: 5, label: "Open Verification", url }],
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