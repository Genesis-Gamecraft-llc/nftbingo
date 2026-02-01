"use client";

import React from "react";
import SolanaProviders from "./solana-providers";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SolanaProviders>{children}</SolanaProviders>;
}
