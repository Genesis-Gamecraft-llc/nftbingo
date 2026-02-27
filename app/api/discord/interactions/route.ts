// app/api/discord/interactions/route.ts
export const runtime = "nodejs";

import nacl from "tweetnacl";
import { createVerifyState, checkCooldown, getLinked } from "@/lib/verify-store";

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

  // ✅ FIX: no trailing comma — route must not crash
  return nacl.sign.detached.verify(msg, sig, pk);
}

function buildVerifyUrls(state: string) {
  const base = `${APP_ORIGIN().replace(/\/$/, "")}/verify?state=${encodeURIComponent(state)}`;

  const encodedBase = encodeURIComponent(base);
  const ref = encodeURIComponent(APP_ORIGIN().replace(/\/$/, ""));

  // Universal links (sometimes fail inside Discord webview)
  const phantomUniversal = `https://phantom.app/ul/browse/${encodedBase}?ref=${ref}`;
  const solflareUniversal = `https://solflare.com/ul/v1/browse/${encodedBase}?ref=${ref}`;

  // ✅ Phantom app-scheme fallback
  const phantomScheme = `phantom://browse/${encodedBase}`;

  return { base, phantomUniversal, phantomScheme, solflareUniversal };
}

function mobileTipText() {
  return "Mobile tip: If the verify page can’t connect your wallet from Discord, tap ⋯ and choose **Open in Browser**.";
}

function verifyChannelOnlyMessage() {
  const ch = VERIFY_CHANNEL_ID();
  return ch ? `Run this in <#${ch}>.` : "Run this in the verify channel.";
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

export async function POST(req: Request) {
  // IMPORTANT: Discord needs a valid JSON response *fast*. Any thrown error must still return type:4 JSON.
  try {
    const publicKeyHex = getEnv("DISCORD_PUBLIC_KEY");
    if (!publicKeyHex) return discordEphemeral("Server misconfigured: Missing DISCORD_PUBLIC_KEY.");

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

    const userId = interaction?.member?.user?.id || interaction?.user?.id || "";
    const channelId = interaction?.channel_id || "";
    const verifyChannelId = VERIFY_CHANNEL_ID();

    // Cooldown (fail-open: if Redis hiccups, we still respond)
    const enforceCooldown = async () => {
      if (!userId) return true;
      try {
        return await checkCooldown(userId, 5 * 60);
      } catch {
        return true;
      }
    };

    // =========================
    // BUTTON: start_verify_button
    // =========================
    if (interaction?.type === 3 && interaction?.data?.custom_id === "start_verify_button") {
      if (verifyChannelId && channelId !== verifyChannelId) {
        return discordEphemeral(`Click this button in <#${verifyChannelId}>.`);
      }

      const allowed = await enforceCooldown();
      if (!allowed) return discordEphemeral("Cooldown: try again in a few minutes.");

      const { state } = await createVerifyState(userId);
      const { base, phantomUniversal, phantomScheme, solflareUniversal } = buildVerifyUrls(state);

      return discordEphemeral(`Click below to verify your wallet.\n${mobileTipText()}`, [
        {
          type: 1,
          components: [
            { type: 2, style: 5, label: "Open Verification", url: base },
            { type: 2, style: 5, label: "Open in Solflare", url: solflareUniversal },
            { type: 2, style: 5, label: "Open in Phantom", url: phantomUniversal },
            { type: 2, style: 5, label: "Open in Phantom (alt)", url: phantomScheme },
          ],
        },
      ]);
    }

    // =========================
    // SLASH COMMANDS
    // =========================
    const name = (interaction?.data?.name as string | undefined) || "";

    if ((name === "verify" || name === "refresh") && verifyChannelId && channelId !== verifyChannelId) {
      return discordEphemeral(verifyChannelOnlyMessage());
    }

    if (name === "verify") {
      const allowed = await enforceCooldown();
      if (!allowed) return discordEphemeral("Cooldown: try again in a few minutes.");

      const { state } = await createVerifyState(userId);
      const { base, phantomUniversal, phantomScheme, solflareUniversal } = buildVerifyUrls(state);

      return discordEphemeral(`Click to verify your wallet:\n${mobileTipText()}`, [
        {
          type: 1,
          components: [
            { type: 2, style: 5, label: "Verify Wallet", url: base },
            { type: 2, style: 5, label: "Open in Solflare", url: solflareUniversal },
            { type: 2, style: 5, label: "Open in Phantom", url: phantomUniversal },
            { type: 2, style: 5, label: "Open in Phantom (alt)", url: phantomScheme },
          ],
        },
      ]);
    }

    if (name === "refresh") {
      const allowed = await enforceCooldown();
      if (!allowed) return discordEphemeral("Cooldown: try again in a few minutes.");

      const linked = await getLinked(userId);
      const { state } = await createVerifyState(userId);
      const { base, phantomUniversal, phantomScheme, solflareUniversal } = buildVerifyUrls(state);

      if (!linked) {
        return discordEphemeral(`You’re not linked yet. Use /verify first.\n${mobileTipText()}`, [
          {
            type: 1,
            components: [
              { type: 2, style: 5, label: "Verify Wallet", url: base },
              { type: 2, style: 5, label: "Open in Solflare", url: solflareUniversal },
              { type: 2, style: 5, label: "Open in Phantom", url: phantomUniversal },
              { type: 2, style: 5, label: "Open in Phantom (alt)", url: phantomScheme },
            ],
          },
        ]);
      }

      return discordEphemeral(
        `You’re already linked to **${linked.wallet}**.\nOpen the page below to refresh holder roles (quick sign).\n${mobileTipText()}`,
        [
          {
            type: 1,
            components: [
              { type: 2, style: 5, label: "Refresh Roles", url: base },
              { type: 2, style: 5, label: "Open in Solflare", url: solflareUniversal },
              { type: 2, style: 5, label: "Open in Phantom", url: phantomUniversal },
              { type: 2, style: 5, label: "Open in Phantom (alt)", url: phantomScheme },
            ],
          },
        ]
      );
    }

    // Always respond
    return discordEphemeral("Unhandled interaction.");
  } catch (e: any) {
    // Always respond with a Discord interaction response, never let it crash out.
    const msg = String(e?.message || e || "Unknown error");
    return discordEphemeral(`Verification error: ${msg}`);
  }
}

export async function GET() {
  return json({ ok: true });
}