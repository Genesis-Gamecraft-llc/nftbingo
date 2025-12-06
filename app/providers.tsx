"use client";

import "@rainbow-me/rainbowkit/styles.css";

import {
  getDefaultConfig,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";

import { WagmiProvider } from "wagmi";
import { polygonAmoy } from "wagmi/chains";   // ✅ correct chain import

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

// --------------------------------------------
// Configure Wagmi + RainbowKit
// --------------------------------------------
const config = getDefaultConfig({
  appName: "NFTBingo",
  projectId: "nftbingo-connect",
  chains: [polygonAmoy],     // ✅ FORCE Amoy everywhere
  ssr: true,
});

const queryClient = new QueryClient();

// --------------------------------------------
// Provider wrapper
// --------------------------------------------
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {/* RainbowKitProvider no longer needs explicit chain prop */}
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
