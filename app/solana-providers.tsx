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

export default function SolanaProviders({ children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const network = WalletAdapterNetwork.Mainnet;

  // Use paid RPC if provided, otherwise fall back to the public cluster endpoint.
  const endpoint = useMemo(() => {
    return (
      process.env.NEXT_PUBLIC_SOLANA_RPC?.trim() || clusterApiUrl("mainnet-beta")
    );
  }, []);

  // Only use WS if explicitly configured.
  const wsEndpoint = useMemo(() => {
    const v = process.env.NEXT_PUBLIC_SOLANA_WS?.trim();
    return v && v.length ? v : undefined;
  }, []);

  // ONLY these wallets. Nothing else.
  const wallets = useMemo(() => {
    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new BackpackWalletAdapter(),
    ];
  }, [network]);

  const connectionConfig = useMemo(() => {
    const base: any = { commitment: "confirmed" };
    if (wsEndpoint) base.wsEndpoint = wsEndpoint;
    return base;
  }, [wsEndpoint]);

  if (!mounted) return null;

  return (
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
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