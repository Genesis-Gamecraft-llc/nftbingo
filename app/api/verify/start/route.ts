export const runtime = "nodejs";

import { getVerifyState } from "@/lib/verify-store";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const state = typeof body?.state === "string" ? body.state : "";
    const wallet = typeof body?.wallet === "string" ? body.wallet : "";

    if (!state) return json({ error: "Missing state. Go back to Discord and run /verify again." }, 400);
    if (!wallet) return json({ error: "Missing wallet. Connect your wallet first." }, 400);

    // ✅ Safe parse (no JSON.parse crash)
    const st = await getVerifyState(state);
    if (!st) {
      return json(
        { error: "State expired or invalid. Go back to Discord and click Verify Wallet again." },
        400
      );
    }

    const message =
      `NFTBingo verification\n\n` +
      `Wallet: ${wallet}\n` +
      `Nonce: ${st.nonce}\n\n` +
      `Sign to verify ownership.`;

    return json({ ok: true, message });
  } catch (e: any) {
    return json({ error: e?.message || "Verify start failed." }, 500);
  }
}

export async function GET() {
  return json({ ok: true });
}