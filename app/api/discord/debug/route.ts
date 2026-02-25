export const runtime = "nodejs";

import { redis } from "@/lib/upstash";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET() {
  const [lastHit, lastErr, lastHeaders] = await Promise.all([
    redis.get<string>("discord:interactions:last_hit"),
    redis.get<string>("discord:interactions:last_error"),
    redis.get<string>("discord:interactions:last_headers"),
  ]);

  return json({
    last_hit: lastHit ? new Date(Number(lastHit)).toISOString() : null,
    last_error: lastErr || null,
    last_headers: lastHeaders ? JSON.parse(lastHeaders) : null,
  });
}