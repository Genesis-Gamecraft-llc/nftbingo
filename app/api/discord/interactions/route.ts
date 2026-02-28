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

  return nacl.sign.detached.verify(msg, sig, pk);
}

function buildVerifyUrls(state: string) {
  const base = `${APP_ORIGIN().replace(/\/$/, "")}/verify?state=${encodeURIComponent(state)}`;

  const encodedBase = encodeURIComponent(base);
  const ref = encodeURIComponent(APP_ORIGIN().replace(/\/$/, ""));

  const phantomUniversal = `https://phantom.app/ul/browse/${encodedBase}?ref=${ref}`;
  const solflareUniversal = `https://solflare.com/ul/v1/browse/${encodedBase}?ref=${ref}`;

  // Phantom app-scheme fallback (often works when universal links don't)
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

/**
 * ✅ HARD TIMEOUT WRAPPER
 * Prevent Discord "didn't respond in time" by ensuring Redis/Upstash never blocks longer than a short limit.
 */
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

    // Discord PING
    if (interaction?.type === 1) return json({ type: 1 });

    const userId = interaction?.member?.user?.id || interaction?.user?.id || "";
    const channelId = interaction?.channel_id || "";
    const verifyChannelId = VERIFY_CHANNEL_ID();

    // Cooldown (fail-open, but with a hard timeout so it never hangs)
    const enforceCooldown = async () => {
      if (!userId) return true;
      try {
        // keep this short so we always answer Discord in time
        return await withTimeout(checkCooldown(userId, 1 * 60), 900, "Cooldown check");
      } catch {
        // If Redis is slow/down, don't hard-fail interaction — just allow.
        return true;
      }
    };

    // =========================
    // BUTTON CLICK: start_verify_button
    // =========================
    if (interaction?.type === 3 && interaction?.data?.custom_id === "start_verify_button") {
      if (verifyChannelId && channelId !== verifyChannelId) {
        return discordEphemeral(`Click this button in <#${verifyChannelId}>.`);
      }

      const allowed = await enforceCooldown();
      if (!allowed) return discordEphemeral("Cooldown: try again in a few minutes.");

      let state: string;
      try {
        // hard timeout so we never hang Discord
        ({ state } = await withTimeout(createVerifyState(userId), 1200, "State creation"));
      } catch {
        return discordEphemeral(
          `Verification backend is busy right now. Try again in a moment.\n${mobileTipText()}`
        );
      }

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

      let state: string;
      try {
        ({ state } = await withTimeout(createVerifyState(userId), 1200, "State creation"));
      } catch {
        return discordEphemeral(
          `Verification backend is busy right now. Try again in a moment.\n${mobileTipText()}`
        );
      }

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

      // linked lookup must not hang
      let linked: any = null;
      try {
        linked = await withTimeout(getLinked(userId), 900, "Linked lookup");
      } catch {
        // If Redis stalls, still allow user to refresh via a new verify link
        linked = null;
      }

      let state: string;
      try {
        ({ state } = await withTimeout(createVerifyState(userId), 1200, "State creation"));
      } catch {
        return discordEphemeral(
          `Verification backend is busy right now. Try again in a moment.\n${mobileTipText()}`
        );
      }

      const { base, phantomUniversal, phantomScheme, solflareUniversal } = buildVerifyUrls(state);

      if (!linked) {
        return discordEphemeral(`Open the page below to verify/refresh your roles.\n${mobileTipText()}`, [
          {
            type: 1,
            components: [
              { type: 2, style: 5, label: "Verify / Refresh", url: base },
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

    return discordEphemeral("Unhandled interaction.");
  } catch (e: any) {
    const msg = String(e?.message || e || "Unknown error");
    return discordEphemeral(`Verification error: ${msg}`);
  }
}

export async function GET() {
  return json({ ok: true });
}