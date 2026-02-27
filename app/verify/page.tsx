"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return { __raw: "" };

  try {
    return JSON.parse(text);
  } catch {
    return { __raw: text };
  }
}

function stringifyErr(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export default function VerifyPage() {
  const params = useSearchParams();
  const state = params.get("state") || "";

  const { publicKey, signMessage, connected } = useWallet();
  const wallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus("");
    setError("");
  }, [state, wallet]);

  async function doVerify() {
    setError("");
    setStatus("Preparing verification...");

    if (!state) {
      setStatus("");
      setError("Missing state token. Go back to Discord and run /verify again.");
      return;
    }
    if (!connected || !publicKey) {
      setStatus("");
      setError("Connect your wallet first.");
      return;
    }
    if (!signMessage) {
      setStatus("");
      setError("Your wallet does not support message signing.");
      return;
    }

    try {
      // 1) Get message to sign
      const startRes = await fetch("/api/verify/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, wallet }),
      });

      const startJson: any = await safeJson(startRes);

      if (!startRes.ok) {
        const msg =
          stringifyErr(startJson?.error) ||
          stringifyErr(startJson?.message) ||
          stringifyErr(startJson?.__raw) ||
          `Verify start failed (HTTP ${startRes.status})`;
        throw new Error(msg);
      }

      const message: any = startJson?.message;
      if (typeof message !== "string" || !message.trim()) {
        throw new Error(
          "Verify start did not return a valid message to sign. (Expected JSON { message: string })."
        );
      }

      // 2) Sign message
      setStatus("Sign the message in your wallet...");
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const bs58 = (await import("bs58")).default;
      const signatureBase58 = bs58.encode(sigBytes);

      // 3) Complete verification + assign roles
      setStatus("Verifying holdings and assigning roles...");
      const res = await fetch("/api/verify/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, wallet, signatureBase58 }),
      });

      const json: any = await safeJson(res);

      if (!res.ok) {
        const msg =
          stringifyErr(json?.error) ||
          stringifyErr(json?.message) ||
          stringifyErr(json?.__raw) ||
          `Verification failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      setStatus("Success! Roles updated. You can return to Discord.");
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

      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12,
        }}
      >
        <div>
          <b>State:</b> {state ? "✅" : "❌"}
        </div>
        <div>
          <b>Wallet:</b> {wallet || "(not connected)"}
        </div>
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