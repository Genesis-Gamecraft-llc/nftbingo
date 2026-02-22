"use client";

import React, { useEffect } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import type { WalletName } from "@solana/wallet-adapter-base";

function isReadyStateOk(readyState: any) {
  // "Installed" and "Loadable" are both usable states for browser wallets.
  return readyState === "Installed" || readyState === "Loadable";
}

export default function SolanaConnectButton({ compact = false }: { compact?: boolean }) {
  const { wallets, wallet, connected, select } = useWallet();

  // If a previously-selected wallet (like Backpack) isn't installed anymore,
  // wallet-adapter will throw WalletNotReadyError when you click Connect.
  // This clears the stored selection so the normal modal opens.
  useEffect(() => {
    if (connected) return;

    // Keys that may exist depending on prior versions
    const keys = ["walletName", "nftbingoWalletName"];

    // If currently-selected wallet isn't ready, clear selection + storage
    if (wallet?.adapter && !isReadyStateOk(wallet.adapter.readyState)) {
      try {
        // unselect
        select(null as unknown as WalletName);
      } catch {}
      try {
        keys.forEach((k) => localStorage.removeItem(k));
      } catch {}
      return;
    }

    // If something is stored but the adapter isn't ready, clear it too
    let stored: string | null = null;
    try {
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v) {
          stored = v;
          break;
        }
      }
    } catch {}

    if (!stored) return;

    const found = wallets.find((w) => w.adapter?.name === stored);
    if (found && !isReadyStateOk(found.adapter.readyState)) {
      try {
        keys.forEach((k) => localStorage.removeItem(k));
      } catch {}
      try {
        select(null as unknown as WalletName);
      } catch {}
    }
  }, [wallet, wallets, connected, select]);

  return (
    <div className="nftbingo-solana-btn" data-compact={compact ? "1" : "0"}>
      <WalletMultiButton />
    </div>
  );
}