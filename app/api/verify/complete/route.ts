export const runtime = "nodejs";

import { verifyWalletSignature } from "@/lib/wallet-sign";
import { consumeVerifyState, setLinked } from "@/lib/verify-store";
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

const ROLE_PLAYERS = () => must("DISCORD_ROLE_PLAYERS");
const ROLE_VIP = () => must("DISCORD_ROLE_VIP");
const ROLE_FOUNDERS = () => must("DISCORD_ROLE_FOUNDERS");

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const state = typeof body?.state === "string" ? body.state : "";
    const wallet = typeof body?.wallet === "string" ? body.wallet : "";
    const signatureBase58 = typeof body?.signatureBase58 === "string" ? body.signatureBase58 : "";

    if (!state) return json({ error: "Missing state. Go back to Discord and run /verify again." }, 400);
    if (!wallet) return json({ error: "Missing wallet. Connect your wallet first." }, 400);
    if (!signatureBase58) return json({ error: "Missing signature. Try again." }, 400);

    const st = await consumeVerifyState(state);
    if (!st) return json({ error: "State expired. Go back to Discord and run /verify again." }, 400);

    const message =
      `NFTBingo verification\n\n` +
      `Wallet: ${wallet}\n` +
      `Nonce: ${st.nonce}\n\n` +
      `Sign to verify ownership.`;

    const sigOk = verifyWalletSignature({ wallet, message, signatureBase58 });
    if (!sigOk) return json({ error: "Invalid signature." }, 401);

    const holdings = await getHoldingsByOwner(wallet);

    const roles = {
      players: !!holdings.players,
      vip: !!holdings.vip,
      founders: !!holdings.founders,
    };

    // Apply roles (stacking)
    if (roles.players) await addRole(st.discordUserId, ROLE_PLAYERS());
    else await removeRole(st.discordUserId, ROLE_PLAYERS());

    if (roles.vip) await addRole(st.discordUserId, ROLE_VIP());
    else await removeRole(st.discordUserId, ROLE_VIP());

    if (roles.founders) await addRole(st.discordUserId, ROLE_FOUNDERS());
    else await removeRole(st.discordUserId, ROLE_FOUNDERS());

    await setLinked(st.discordUserId, wallet, roles);

    return json({ ok: true, roles });
  } catch (e: any) {
    return json({ error: e?.message || "Verify complete failed." }, 500);
  }
}

export async function GET() {
  return json({ ok: true });
}