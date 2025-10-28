"use client";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100 text-slate-800">
      {/* Hero */}
      <section className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white py-20 px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-4">About NFTBingo</h1>
        <p className="max-w-2xl mx-auto text-lg opacity-90">
          Where blockchain innovation meets one of the world’s favorite games.
          Own your cards. Play securely. Earn real rewards.
        </p>
      </section>

      {/* Vision */}
      <section className="max-w-5xl mx-auto py-16 px-6">
        <h2 className="text-3xl font-bold mb-4">Our Vision</h2>
        <p className="text-lg leading-relaxed">
          NFTBingo reimagines classic bingo through blockchain technology. 
          Each bingo card is minted as an NFT—giving players provable ownership, 
          verifiable fairness, and new ways to earn from their cards. 
          From casual players to collectors, everyone can participate in a system 
          that’s transparent, secure, and built to reward engagement.
        </p>
      </section>

      {/* How It Works */}
      <section className="bg-white border-y border-slate-200 py-16 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <ul className="space-y-4 text-lg leading-relaxed list-disc list-inside">
              <li>Buy your NFT Bingo card—each one is unique and tradeable.</li>
              <li>Use <span className="font-semibold">BINGO tokens</span> to buy into games.</li>
              <li>Join 24/7 rooms or limited “player-capped” games for bigger prizes.</li>
              <li>Stake or lend your cards to other players and share in their winnings.</li>
            </ul>
          </div>
          <div className="rounded-xl bg-gradient-to-tr from-pink-50 via-fuchsia-50 to-indigo-50 p-8 shadow-md border border-slate-200 text-center">
            <p className="text-xl font-semibold text-slate-700 mb-2">Provably Fair</p>
            <p className="text-slate-600">All draws are recorded on-chain, ensuring transparent, tamper-proof gameplay.</p>
          </div>
        </div>
      </section>

      {/* Why Polygon */}
      <section className="max-w-5xl mx-auto py-16 px-6">
        <h2 className="text-3xl font-bold mb-4">Why Polygon?</h2>
        <p className="text-lg leading-relaxed">
          Polygon offers lightning-fast transactions, low fees, and full compatibility 
          with Ethereum smart contracts. That means NFTBingo can deliver seamless gameplay 
          and secure rewards without expensive gas costs—perfect for everyday players.
        </p>
      </section>

      {/* Team */}
      <section className="bg-white border-y border-slate-200 py-16 px-6 text-center">
        <h2 className="text-3xl font-bold mb-8">Our Team & Community</h2>
        <p className="max-w-2xl mx-auto text-lg text-slate-600">
          Built by blockchain veterans and lifelong gamers, NFTBingo is a community-driven 
          project focused on transparency, fairness, and fun. Join our Discord, follow us 
          on social media, and help shape the future of on-chain gaming.
        </p>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <a
          href="/whitepaper"
          className="inline-block rounded-xl bg-pink-600 px-8 py-4 text-white font-semibold shadow hover:bg-pink-700"
        >
          Read the Whitepaper
        </a>
        <a
          href="/community"
          className="inline-block ml-4 rounded-xl border border-slate-300 px-8 py-4 font-semibold text-slate-700 hover:bg-white"
        >
          Join the Community
        </a>
      </section>
    </main>
  );
}
