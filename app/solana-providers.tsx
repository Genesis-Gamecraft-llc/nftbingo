"use client";

import React, { useMemo } from "react";
import { clusterApiUrl } from "@solana/web3.js";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";

import "@solana/wallet-adapter-react-ui/styles.css";

type Props = {
  children: React.ReactNode;
};

function getNetwork(): WalletAdapterNetwork {
  const raw = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet").toLowerCase();
  if (raw === "mainnet" || raw === "mainnet-beta") return WalletAdapterNetwork.Mainnet;
  return WalletAdapterNetwork.Devnet;
}

export default function SolanaProviders({ children }: Props) {
  const network = getNetwork();

  const endpoint = useMemo(() => {
    const custom = process.env.NEXT_PUBLIC_SOLANA_RPC?.trim();
    if (custom) return custom;

    const cluster = network === WalletAdapterNetwork.Mainnet ? "mainnet-beta" : "devnet";
    return clusterApiUrl(cluster);
  }, [network]);

  const wallets = useMemo(() => {
    // Build the list explicitly
    const list = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new BackpackWalletAdapter(),
    ];

    // Hard enforce ONLY these wallets and ensure unique names.
    // This prevents React key duplication errors like duplicate "MetaMask".
    const allowed = new Set(["Phantom", "Solflare", "Backpack"]);
    const seen = new Set<string>();

    return list.filter((w) => {
      const name = String((w as any)?.name ?? "");
      if (!allowed.has(name)) return false;
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [network]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
