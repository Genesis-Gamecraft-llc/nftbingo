"use client";

export function Providers({ children }: { children: React.ReactNode }) {
  // EVM providers removed during Solana migration.
  return <>{children}</>;
}
