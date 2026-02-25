"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

export default function VerifyPage() {
  const params = useSearchParams();
  const state = params.get("state") || "";
  const { publicKey, signMessage, connected } = useWallet();

  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const wallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  useEffect(() => {
    setError("");
    setStatus("");
  }, [state, wallet]);

  async function doVerify() {
    setError("");
    setStatus("Preparing verification...");

    if (!state) {
      setError("Missing state token. Go back to Discord and run /verify again.");
      return;
    }
    if (!connected || !publicKey) {
      setError("Connect your wallet first.");
      return;
    }
    if (!signMessage) {
      setError("Your wallet does not support message signing.");
      return;
    }

    try {
      // ask server for nonce message (derived from state)
      const startRes = await fetch("/api/verify/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, wallet }),
      });
      const startJson = await startRes.json();
      if (!startRes.ok) throw new Error(startJson?.error || "Failed to start verification");

      const message: string = startJson.message;

      setStatus("Sign the message in your wallet...");
      const sigBytes = await signMessage(new TextEncoder().encode(message));

      // Convert signature bytes to base58
      const bs58 = (await import("bs58")).default;
      const signatureBase58 = bs58.encode(sigBytes);

      setStatus("Verifying holdings and assigning roles...");
      const res = await fetch("/api/verify/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, wallet, signatureBase58 }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Verification failed");

      setStatus(`Success! Roles updated. You can return to Discord.`);
    } catch (e: any) {
      setStatus("");
      setError(e?.message || "Verification failed");
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>NFTBingo Holder Verification</h1>

      <p style={{ marginTop: 8, opacity: 0.85 }}>
        Connect your wallet and sign a message to verify ownership of your NFTBingo cards.
      </p>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12 }}>
        <div><b>State:</b> {state ? "✅" : "❌"}</div>
        <div><b>Wallet:</b> {wallet || "(not connected)"}</div>
      </div>

      <button
        onClick={doVerify}
        style={{
          marginTop: 16,
          padding: "12px 16px",
          borderRadius: 12,
          fontWeight: 800,
          width: "100%",
          cursor: "pointer",
        }}
      >
        Verify Now
      </button>

      {status && <div style={{ marginTop: 12 }}>{status}</div>}
      {error && <div style={{ marginTop: 12, color: "#ff6b6b" }}>{error}</div>}

      <div style={{ marginTop: 16, opacity: 0.7, fontSize: 12 }}>
        Tip: If this link expires, go back to Discord and run <b>/verify</b> again.
      </div>
    </div>
  );
}