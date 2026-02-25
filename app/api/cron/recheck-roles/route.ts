export const runtime = "nodejs";

import { listLinkedUserIds, getLinked, updateLastCheck } from "@/lib/verify-store";
import { getHoldingsByOwner } from "@/lib/solana-holdings";
import { addRole, removeRole } from "@/lib/discord-api";

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

const ROLE_VIP = () => must("DISCORD_ROLE_VIP");
const ROLE_FOUNDERS = () => must("DISCORD_ROLE_FOUNDERS");
const CRON_SECRET = () => must("CRON_SECRET");

export async function GET(req: Request) {
  // ✅ Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${CRON_SECRET()}`;

  if (auth !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  const ids = await listLinkedUserIds(5000);

  let checked = 0;
  let updated = 0;

  for (const discordUserId of ids) {
    const rec = await getLinked(discordUserId);
    if (!rec?.wallet) continue;

    checked++;

    try {
      const h = await getHoldingsByOwner(rec.wallet);

      // VIP
      if (h.vip) {
        await addRole(discordUserId, ROLE_VIP());
      } else {
        await removeRole(discordUserId, ROLE_VIP());
      }

      // Founders
      if (h.founders) {
        await addRole(discordUserId, ROLE_FOUNDERS());
      } else {
        await removeRole(discordUserId, ROLE_FOUNDERS());
      }

      await updateLastCheck(discordUserId, {
        players: rec.lastRoles.players, // leave Players alone
        vip: !!h.vip,
        founders: !!h.founders,
      });

      updated++;
    } catch {
      // Don't break cron if one user fails
      continue;
    }
  }

  return json({
    ok: true,
    checked,
    updated,
    timestamp: Date.now(),
  });
}