export const runtime = "nodejs";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const BOT_TOKEN = () => must("DISCORD_BOT_TOKEN");
const CHANNEL_ID = () => must("DISCORD_VERIFY_CHANNEL_ID");

// Reuse CRON_SECRET as admin secret for posting the button
const ADMIN_SECRET = () => must("CRON_SECRET");

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${ADMIN_SECRET()}`;

  if (auth !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  const res = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID()}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content:
        "🎟 **NFTBingo Holder Verification**\n\nClick the button below to verify your wallet and receive your holder roles.",
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: "Verify Wallet",
              custom_id: "start_verify_button",
            },
          ],
        },
      ],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: data }, 500);

  return json({ ok: true, messageId: data?.id || null });
}