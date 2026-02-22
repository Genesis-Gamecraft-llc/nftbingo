"use client";

import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function SolanaConnectButton() {
  return (
    // Styling is handled in globals.css under `.nftbingo-solana-btn ...`
    <div className="nftbingo-solana-btn">
      <WalletMultiButton />
    </div>
  );
}