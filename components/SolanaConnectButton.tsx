"use client";

import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function SolanaConnectButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent SSR / hydration mismatch
  if (!mounted) return null;

  return (
    <div className="nftbingo-solana-btn">
      <WalletMultiButton />
    </div>
  );
}
