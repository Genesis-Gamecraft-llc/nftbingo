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

      {/* Vision & Mission */}
      <section className="max-w-5xl mx-auto py-16 px-6 text-center md:text-left">
        <h2 className="text-3xl font-bold mb-4 text-pink-600">Our Vision</h2>
        <p className="text-lg leading-relaxed mb-8">
          NFTBingo reimagines classic bingo through blockchain technology. Each bingo card is minted as an NFT—giving players provable ownership, verifiable fairness, and new ways to earn from their cards. From casual players to collectors, everyone can participate in a system that’s transparent, secure, and built to reward engagement.
        </p>

        <h2 className="text-3xl font-bold mb-4 text-indigo-600">Our Mission</h2>
        <p className="text-lg leading-relaxed">
          To redefine casual gaming through true ownership, fairness, and decentralized reward systems. We aim to merge nostalgia with next-generation transparency—where every win, card, and draw is verifiable on-chain.
        </p>
      </section>

      {/* Origins */}
      <section className="bg-white border-y border-slate-200 py-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-fuchsia-600">Our Story</h2>
          <p className="text-lg text-slate-700 leading-relaxed">
            NFTBingo began as a simple idea: take the timeless fun of bingo and give players real ownership and transparency. Our team of blockchain veterans and lifelong gamers built a system that rewards players, protects fairness, and connects communities through smart contracts and NFTs.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-6xl mx-auto py-16 px-6 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl font-bold mb-4 text-pink-600">How It Works</h2>
          <ul className="space-y-4 text-lg leading-relaxed list-disc list-inside">
            <li>Buy your NFT Bingo card—each one is unique and tradeable.</li>
            <li>Use <span className="font-semibold">BINGO tokens</span> to buy into games.</li>
            <li>Join 24/7 rooms or limited “player-capped” games for bigger prizes.</li>
            <li>Stake or lend your cards to other players and share in their winnings.</li>
          </ul>
        </div>
        <div className="rounded-xl bg-gradient-to-tr from-pink-50 via-fuchsia-50 to-indigo-50 p-8 shadow-md border border-slate-200 text-center">
          <p className="text-xl font-semibold text-slate-700 mb-2">Provably Fair</p>
          <p className="text-slate-600">
            All draws are recorded on-chain, ensuring transparent, tamper-proof gameplay.
          </p>
        </div>
      </section>

      {/* Why Polygon */}
      <section className="max-w-5xl mx-auto py-16 px-6">
        <h2 className="text-3xl font-bold mb-4 text-indigo-600">Why Polygon?</h2>
        <p className="text-lg leading-relaxed">
          Polygon offers lightning-fast transactions, low fees, and full compatibility with Ethereum smart contracts.
          That means NFTBingo can deliver seamless gameplay and secure rewards without expensive gas costs—perfect for everyday players.
        </p>
      </section>

      {/* Core Values */}
      <section className="bg-white border-y border-slate-200 py-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6 text-fuchsia-600">Our Core Values</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-pink-600 mb-2">Transparency</h3>
              <p className="text-slate-700">Every transaction, draw, and reward is visible on the blockchain.</p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-indigo-600 mb-2">Fairness</h3>
              <p className="text-slate-700">Our smart contracts ensure outcomes are provably fair—no hidden algorithms, no rigged systems.</p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-fuchsia-600 mb-2">Community</h3>
              <p className="text-slate-700">We’re building a space where players, collectors, and creators collaborate to shape the future of NFT gaming.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team & Community */}
      <section className="py-16 px-6 text-center">
        <h2 className="text-3xl font-bold mb-8 text-pink-600">Our Team & Community</h2>
        <p className="max-w-2xl mx-auto text-lg text-slate-600 mb-10">
          Built by blockchain veterans and lifelong gamers, NFTBingo is a community-driven project focused on transparency, fairness, and fun. Join our Discord, follow us on social media, and help shape the future of on-chain gaming.
        </p>
        <a
          href="/community"
          className="inline-block rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-8 py-4 shadow hover:shadow-lg transition"
        >
          Join the Community
        </a>
      </section>

      {/* CTA */}
      <section className="py-20 text-center bg-gradient-to-r from-fuchsia-50 to-indigo-50 border-t border-slate-200">
        <a
          href="/whitepaper"
          className="inline-block rounded-xl bg-pink-600 px-8 py-4 text-white font-semibold shadow hover:bg-pink-700 transition"
        >
          Read the Whitepaper
        </a>
        <a
          href="/join"
          className="inline-block ml-4 rounded-xl border border-slate-300 px-8 py-4 font-semibold text-slate-700 hover:bg-white transition"
        >
          Join the Mailing List
        </a>
      </section>
    </main>
  );
}
