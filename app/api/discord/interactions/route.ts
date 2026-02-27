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

  return nacl.sign.detached.verify(msg, sig, pk,);
}

function getEnv(name: string) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : "";
}

const VERIFY_CHANNEL_ID = () => getEnv("DISCORD_VERIFY_CHANNEL_ID");
const APP_ORIGIN = () => getEnv("APP_ORIGIN") || "https://nftbingo.net";

function buildVerifyUrls(state: string) {
  const base = `${APP_ORIGIN().replace(/\/$/, "")}/verify?state=${encodeURIComponent(state)}`;

  // We need two encodings:
  // - For universal links, Phantom/Solflare expect the target URL to be URL-encoded in the path.
  // - For the phantom:// scheme, Phantom expects a normal URL after /browse/ (still URL-encoded is safest).
  const encodedBase = encodeURIComponent(base);
  const ref = encodeURIComponent(APP_ORIGIN().replace(/\/$/, ""));

  // Universal links (sometimes fail inside Discord webview on Android)
  const phantomUniversal = `https://phantom.app/ul/browse/${encodedBase}?ref=${ref}`;
  const solflareUniversal = `https://solflare.com/ul/v1/browse/${encodedBase}?ref=${ref}`;

  // ✅ Fallback scheme for Phantom (often succeeds where universal links don't)
  // Note: Some browsers/webviews may block custom schemes; that’s why we keep BOTH.
  const phantomScheme = `phantom://browse/${encodedBase}`;

  return { base, phantomUniversal, phantomScheme, solflareUniversal };
}

function verifyChannelOnlyMessage() {
  const ch = VERIFY_CHANNEL_ID();
  return ch ? `Run this in <#${ch}>.` : "Run this in the verify channel.";
}

function mobileTipText() {
  return "Mobile tip: If the verify page can’t connect your wallet from Discord, tap ⋯ and choose **Open in Browser**.";
}

export async function POST(req: Request) {
  try {
    const publicKeyHex = getEnv("DISCORD_PUBLIC_KEY");
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

    // Discord PING
    if (interaction?.type === 1) return json({ type: 1 });

    const userId = interaction?.member?.user?.id || interaction?.user?.id;
    const channelId = interaction?.channel_id;

    // 5-minute cooldown per user for verify/refresh/button
    async function enforceCooldown() {
      if (!userId) return true;
      try {
        return await checkCooldown(userId, 5 * 60);
      } catch {
        // If cooldown storage fails, don't hard-fail the interaction.
        return true;
      }
    }

    const verifyChannelId = VERIFY_CHANNEL_ID();

    // =========================
    // BUTTON CLICK HANDLER
    // =========================
    if (interaction?.type === 3 && interaction?.data?.custom_id === "start_verify_button") {
      if (verifyChannelId && channelId !== verifyChannelId) {
        return json({
          type: 4,
          data: { flags: 64, content: `Click this button in <#${verifyChannelId}>.` },
        });
      }

      const allowed = await enforceCooldown();
      if (!allowed) {
        return json({ type: 4, data: { flags: 64, content: "Cooldown: try again in a few minutes." } });
      }

      const { state } = await createVerifyState(userId);
      const { base, phantomUniversal, phantomScheme, solflareUniversal } = buildVerifyUrls(state);

      return json({
        type: 4,
        data: {
          flags: 64,
          content: `Click below to verify your wallet.\n${mobileTipText()}`,
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 5, label: "Open Verification", url: base },
                { type: 2, style: 5, label: "Open in Solflare", url: solflareUniversal },
                { type: 2, style: 5, label: "Open in Phantom", url: phantomUniversal },
                { type: 2, style: 5, label: "Open in Phantom (alt)", url: phantomScheme },
              ],
            },
          ],
        },
      });
    }

    // =========================
    // SLASH COMMANDS
    // =========================
    const name = interaction?.data?.name as string | undefined;

    if ((name === "verify" || name === "refresh") && verifyChannelId && channelId !== verifyChannelId) {
      return json({ type: 4, data: { flags: 64, content: verifyChannelOnlyMessage() } });
    }

    if (name === "verify") {
      const allowed = await enforceCooldown();
      if (!allowed) {
        return json({ type: 4, data: { flags: 64, content: "Cooldown: try again in a few minutes." } });
      }

      const { state } = await createVerifyState(userId);
      const { base, phantomUniversal, phantomScheme, solflareUniversal } = buildVerifyUrls(state);

      return json({
        type: 4,
        data: {
          flags: 64,
          content: `Click to verify your wallet:\n${mobileTipText()}`,
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 5, label: "Verify Wallet", url: base },
                { type: 2, style: 5, label: "Open in Solflare", url: solflareUniversal },
                { type: 2, style: 5, label: "Open in Phantom", url: phantomUniversal },
                { type: 2, style: 5, label: "Open in Phantom (alt)", url: phantomScheme },
              ],
            },
          ],
        },
      });
    }

    if (name === "refresh") {
      const allowed = await enforceCooldown();
      if (!allowed) {
        return json({ type: 4, data: { flags: 64, content: "Cooldown: try again in a few minutes." } });
      }

      const linked = await getLinked(userId);
      const { state } = await createVerifyState(userId);
      const { base, phantomUniversal, phantomScheme, solflareUniversal } = buildVerifyUrls(state);

      if (!linked) {
        return json({
          type: 4,
          data: {
            flags: 64,
            content: `You’re not linked yet. Use /verify first.\n${mobileTipText()}`,
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 5, label: "Verify Wallet", url: base },
                  { type: 2, style: 5, label: "Open in Solflare", url: solflareUniversal },
                  { type: 2, style: 5, label: "Open in Phantom", url: phantomUniversal },
                  { type: 2, style: 5, label: "Open in Phantom (alt)", url: phantomScheme },
                ],
              },
            ],
          },
        });
      }

      return json({
        type: 4,
        data: {
          flags: 64,
          content: `You’re already linked to **${linked.wallet}**.\nOpen the page below to refresh holder roles (quick sign).\n${mobileTipText()}`,
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 5, label: "Refresh Roles", url: base },
                { type: 2, style: 5, label: "Open in Solflare", url: solflareUniversal },
                { type: 2, style: 5, label: "Open in Phantom", url: phantomUniversal },
                { type: 2, style: 5, label: "Open in Phantom (alt)", url: phantomScheme },
              ],
            },
          ],
        },
      });
    }

    // Always respond so Discord never shows "This interaction failed"
    return json({ type: 4, data: { flags: 64, content: "Unhandled interaction." } });
  } catch (e: any) {
    // Return a valid Discord response even on errors
    const msg = String(e?.message || e || "Unknown error");
    return json({
      type: 4,
      data: { flags: 64, content: `Verification error: ${msg}` },
    });
  }
}

export async function GET() {
  return json({ ok: true });
}