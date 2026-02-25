export const runtime = "nodejs";

import { verifyWalletSignature } from "@/lib/wallet-sign";
import { consumeVerifyState, setLinked } from "@/lib/verify-store";
import { getHoldingsByOwner } from "@/lib/solana-holdings";
import { addRole, removeRole } from "@/lib/discord-api";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const ROLE_PLAYERS = () => must("DISCORD_ROLE_PLAYERS");
const ROLE_VIP = () => must("DISCORD_ROLE_VIP");
const ROLE_FOUNDERS = () => must("DISCORD_ROLE_FOUNDERS");

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  const { state, wallet, signatureBase58 } = await req.json().catch(() => ({}));

  if (!state || typeof state !== "string") return json({ error: "Missing state" }, 400);
  if (!wallet || typeof wallet !== "string") return json({ error: "Missing wallet" }, 400);
  if (!signatureBase58 || typeof signatureBase58 !== "string") return json({ error: "Missing signature" }, 400);

  const st = await consumeVerifyState(state);
  if (!st) return json({ error: "State expired. Run /verify again in Discord." }, 400);

  const message = `NFTBingo verification\n\nWallet: ${wallet}\nNonce: ${st.nonce}\n\nSign to verify ownership.`;

  const sigOk = verifyWalletSignature({ wallet, message, signatureBase58 });
  if (!sigOk) return json({ error: "Invalid signature." }, 401);

  let holdings;
  try {
    holdings = await getHoldingsByOwner(wallet);
  } catch (e: any) {
    return json({ error: e?.message || "Failed to check holdings." }, 500);
  }

  // Everyone should have Players, but we still enforce collection-based truth:
  // If they don't have Players NFT for some reason, we won't assign base access.
  const roles = {
    players: !!holdings.players,
    vip: !!holdings.vip,
    founders: !!holdings.founders,
  };

  // Apply roles (stacking)
  try {
    if (roles.players) await addRole(st.discordUserId, ROLE_PLAYERS());
    else await removeRole(st.discordUserId, ROLE_PLAYERS());

    if (roles.vip) await addRole(st.discordUserId, ROLE_VIP());
    else await removeRole(st.discordUserId, ROLE_VIP());

    if (roles.founders) await addRole(st.discordUserId, ROLE_FOUNDERS());
    else await removeRole(st.discordUserId, ROLE_FOUNDERS());
  } catch (e: any) {
    return json({ error: e?.message || "Failed to update Discord roles." }, 500);
  }

  await setLinked(st.discordUserId, wallet, roles);

  return json({ ok: true, roles });
}