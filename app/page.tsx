"use client";

import BingoBalls from "@/components/BingoBalls";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-gradient-to-b from-white to-slate-100 overflow-hidden">
      <BingoBalls />
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white py-24 px-6 text-center">
        {/* Floating balls (decorative) */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 left-20 h-24 w-24 bg-white/10 rounded-full blur-2xl animate-pulse" />
          <div className="absolute bottom-0 right-16 h-16 w-16 bg-white/20 rounded-full blur-xl animate-ping" />
        </div>

        <h1 className="relative text-5xl md:text-7xl font-extrabold mb-6 z-10">
          Play. Earn. Own.
        </h1>
        <p className="relative max-w-2xl mx-auto text-lg opacity-90 z-10">
          The world’s first decentralized bingo platform on{" "}
          <span className="font-bold text-yellow-200">Polygon</span> — where
          every card is an NFT and every game is provably fair.
        </p>

        <div className="relative mt-10 flex flex-wrap justify-center gap-4 z-10">
          <a
            href="#enter"
            className="rounded-xl bg-white text-pink-600 font-semibold px-8 py-4 shadow hover:bg-slate-100"
          >
            Enter App
          </a>
          <a
            href="/whitepaper"
            className="rounded-xl border-2 border-white text-white font-semibold px-8 py-4 hover:bg-white/10"
          >
            Read Whitepaper
          </a>
        </div>
      </section>

      {/* Intro */}
      <section className="max-w-5xl mx-auto py-20 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          NFT-Powered Bingo with Real Rewards
        </h2>
        <p className="text-lg text-slate-600 leading-relaxed">
          NFTBingo combines the fun of classic bingo with the transparency of
          blockchain. Buy NFT cards, join live games, and win crypto or NFT
          prizes. Built on Polygon for low fees, fast transactions, and full
          decentralization.
        </p>
      </section>

      {/* Key Features */}
      <section className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 px-6 pb-20">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-2">Ownable Cards</h3>
          <p className="text-slate-600">
            Each card is a unique NFT you can trade, stake, or lend to other
            players.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-2">USD-Pegged Buy-Ins</h3>
          <p className="text-slate-600">
            Game entries auto-adjust based on token value using DEX price
            snapshots.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-2">Transparent Payouts</h3>
          <p className="text-slate-600">
            Winnings distributed instantly in BINGO Token, wETH, wBTC, or NFTs.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 text-center text-slate-500 text-sm">
        © {new Date().getFullYear()} NFTBingo • Built on Polygon • nftbingo.net
      </footer>
    </main>
  );
}
