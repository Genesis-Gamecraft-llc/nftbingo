import "./globals.css";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "NFTBingo – Own. Play. Win. Earn",
  description:
    "NFTBingo is a blockchain-powered bingo platform where players own NFT cards, play provably fair games, win prizes, and earn rewards.",

  openGraph: {
    title: "NFTBingo – Own. Play. Win. Earn",
    description:
      "Own NFT bingo cards. Play provably fair games. Win prizes. Earn rewards through gameplay and staking on NFTBingo.",
    url: "https://nftbingo.com", // change if different
    siteName: "NFTBingo",
    images: [
      {
        url: "/images/social-preview.png",
        width: 1200,
        height: 630,
        alt: "NFTBingo – Own. Play. Win. Earn",
      },
    ],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "NFTBingo – Own. Play. Win. Earn",
    description: "Own NFT bingo cards. Play fair games. Win prizes. Earn rewards on NFTBingo.",
    images: ["/images/social-preview.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900">
        <Providers>
  <Navbar />
  <div className="pt-20">{children}</div>
</Providers>

      </body>
    </html>
  );
}
