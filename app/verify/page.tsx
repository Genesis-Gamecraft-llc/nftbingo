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

const PRIMARY_BTN =
  "bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:scale-105 transition";

function isMobileUA() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isDiscordInAppUA() {
  if (typeof navigator === "undefined") return false;
  return /Discord/i.test(navigator.userAgent);
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
      setError("State expired or invalid. Go back to Discord and click Verify Wallet again.");
      return;
    }

    if (!connected || !publicKey) {
      setStatus("");
      setError("Connect your wallet using the Connect button in the top bar, then click Verify Now.");
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
        throw new Error("Verify start did not return a valid message to sign.");
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

  const showMobileTip = isMobileUA() && isDiscordInAppUA();

  return (
    <div className="mx-auto max-w-[720px] p-6">
      <h1 className="text-[28px] font-extrabold">NFTBingo Holder Verification</h1>

      <p className="mt-2 opacity-85">
        Connect your wallet and sign a message to verify ownership of your NFTBingo cards.
      </p>

      {showMobileTip && (
        <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-4 text-sm">
          <b>Mobile tip:</b> If wallet connect doesn’t open from Discord, tap <b>⋯</b> and choose{" "}
          <b>Open in Browser</b>.
        </div>
      )}

      <div className="mt-4 rounded-xl border border-white/15 p-4">
        <div>
          <b>State:</b> {state ? "✅" : "❌"}
        </div>
        <div className="break-all">
          <b>Wallet:</b> {wallet || "(not connected)"}
        </div>
      </div>

      <button
        onClick={doVerify}
        className={PRIMARY_BTN + " mt-4 w-full"}
        disabled={!state || !connected || !publicKey}
        title={!state ? "Go back to Discord and click Verify Wallet again." : ""}
      >
        Verify Now
      </button>

      {status && <div className="mt-3">{status}</div>}
      {error && <div className="mt-3 text-[#ff6b6b]">{error}</div>}

      <div className="mt-4 text-xs opacity-70">
        Tip: If this link expires, go back to Discord and click Verify Wallet again.
      </div>
    </div>
  );
}