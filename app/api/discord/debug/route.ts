export const runtime = "nodejs";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET() {
  return json({
    ok: true,
    env: {
      hasDiscordPublicKey: !!process.env.DISCORD_PUBLIC_KEY,
      hasDiscordAppId: !!process.env.DISCORD_APPLICATION_ID,
      hasDiscordBotToken: !!process.env.DISCORD_BOT_TOKEN,
      hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    },
  });
}