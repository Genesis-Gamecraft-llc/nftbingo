"use client";

import React, { useEffect, useMemo, useState } from "react";
import { clusterApiUrl } from "@solana/web3.js";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";

import "@solana/wallet-adapter-react-ui/styles.css";

type Props = { children: React.ReactNode };

function removeMetaMaskFromModalOnce() {
  // Wallet-adapter modal renders buttons in this list
  const list = document.querySelector(".wallet-adapter-modal-list");
  if (!list) return;

  const buttons = Array.from(list.querySelectorAll("button"));
  for (const btn of buttons) {
    const text = (btn.textContent || "").toLowerCase();
    // MetaMask sometimes appears twice due to multiple injected providers
    if (text.includes("metamask")) {
      btn.remove();
    }
  }
}

export default function SolanaProviders({ children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Clear any legacy auto-restore wallet selection (often where MetaMask keeps coming back)
    try {
      localStorage.removeItem("walletName");
      localStorage.removeItem("nftbingoWalletName");
    } catch {}

    // MutationObserver: whenever the wallet modal DOM changes, strip MetaMask entries.
    // This is version-proof (no dependency on WalletModalProvider props).
    const obs = new MutationObserver(() => {
      removeMetaMaskFromModalOnce();
    });

    obs.observe(document.documentElement, { childList: true, subtree: true });

    // One extra immediate pass
    removeMetaMaskFromModalOnce();

    return () => obs.disconnect();
  }, []);

  const network = WalletAdapterNetwork.Mainnet;

  const endpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_RPC?.trim() || clusterApiUrl("mainnet-beta");
  }, []);

  const wsEndpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_WS?.trim() || endpoint.replace(/^http/i, "ws");
  }, [endpoint]);

  // Only these adapters are actually selectable/usable
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network }), new BackpackWalletAdapter()],
    [network]
  );

  if (!mounted) return null;

  return (
    <ConnectionProvider endpoint={endpoint} config={{ wsEndpoint, commitment: "confirmed" }}>
      <WalletProvider
        wallets={wallets}
        autoConnect={false}
        localStorageKey="nftbingoWalletName"
        onError={(e) => console.error("[WalletProvider error]", e)}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
