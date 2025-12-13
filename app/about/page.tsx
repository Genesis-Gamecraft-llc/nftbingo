"use client";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100 text-slate-800">
      {/* Hero */}
      <section className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white py-20 px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-4">About NFTBingo</h1>
        <p className="max-w-3xl mx-auto text-lg opacity-90">
          Bingo! Modernized without losing what makes it fun.
          <br />
          Own your cards. Play provably fair. Win together. Earn through participation.
        </p>
      </section>

      {/* Vision & Mission */}
      <section className="max-w-5xl mx-auto py-16 px-6 text-center md:text-left">
        <h2 className="text-3xl font-bold mb-4 text-pink-600">Our Vision</h2>
        <p className="text-lg leading-relaxed mb-8">
          NFTBingo is building a modern bingo platform that keeps traditional gameplay intact while upgrading
          the infrastructure behind it. We use blockchain to make ownership real, verification automatic,
          and outcomes auditable, without turning bingo into a pay-to-win game.
        </p>

        <h2 className="text-3xl font-bold mb-4 text-indigo-600">Our Mission</h2>
        <p className="text-lg leading-relaxed">
          To modernize bingo with true digital ownership, verifiable fairness, and automated prize distribution, and
          to create a system that can scale from online play to real-world halls, charities, and community events.
        </p>
      </section>

      {/* Origins */}
      <section className="bg-white border-y border-slate-200 py-16 px-6">
        <div className="max-w-5xl mx-auto text-center md:text-left">
          <h2 className="text-3xl font-bold mb-4 text-fuchsia-600">Our Story</h2>
          <p className="text-lg text-slate-700 leading-relaxed">
            NFTBingo started with a simple idea: bingo deserves better tools. Paper cards, manual verification,
            and fragmented payout systems are expensive, error-prone, and hard to scale. We’re taking the
            parts that have always worked, patterns, calling BINGO!!, shared excitement, and upgrading the
            backend so gameplay is smoother, fairer, and easier to run anywhere.
          </p>
        </div>
      </section>

      {/* What Makes NFTBingo Different */}
      <section className="max-w-6xl mx-auto py-16 px-6 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl font-bold mb-4 text-pink-600">What Makes NFTBingo Different</h2>
          <ul className="space-y-4 text-lg leading-relaxed list-disc list-inside">
            <li>
              <span className="font-semibold">Provably fair gameplay</span> - randomness and resolution are auditable,
              and payouts are enforced automatically.
            </li>
            <li>
              <span className="font-semibold">True card ownership</span> - your bingo cards are NFTs you can keep,
              reuse, and (where enabled) transfer.
            </li>
            <li>
              <span className="font-semibold">No pay-to-win</span> - all cards have identical odds. Visuals and editions
              are cosmetic; gameplay fairness is non-negotiable.
            </li>
            <li>
              <span className="font-semibold">Stable buy-in experience</span> - pricing is designed to stay consistent
              for players even when token markets move.
            </li>
          </ul>
        </div>

        <div className="rounded-xl bg-gradient-to-tr from-pink-50 via-fuchsia-50 to-indigo-50 p-8 shadow-md border border-slate-200 text-center">
          <p className="text-xl font-semibold text-slate-700 mb-2">Built for Real Bingo</p>
          <p className="text-slate-600">
            We’re not reinventing the rules; we’re modernizing the system so bingo can be faster, cleaner,
            and easier to verify at scale.
          </p>
        </div>
      </section>

      {/* Creator Launchpad */}
      <section className="max-w-5xl mx-auto py-16 px-6">
        <h2 className="text-3xl font-bold mb-4 text-indigo-600">A Launchpad for Creators</h2>
        <p className="text-lg leading-relaxed">
          NFTBingo is also a distribution and engagement engine for creators and early-stage NFT projects.
          Partner artwork can be integrated into card backgrounds, and platform activity can be used to help
          drive attention and demand for partnered projects through prize systems and ecosystem rewards.
        </p>
      </section>

      {/* Physical Integration */}
      <section className="bg-white border-y border-slate-200 py-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-fuchsia-600">Modernizing Physical Bingo</h2>
          <p className="text-lg text-slate-700 leading-relaxed">
            Long term, NFTBingo is designed to extend into real-world halls and community venues using standard
            consumer hardware. Digital card management and automated verification can reduce disputes and
            overhead while keeping the familiar social experience intact.
          </p>
        </div>
      </section>

      {/* Why Polygon */}
      <section className="max-w-5xl mx-auto py-16 px-6">
        <h2 className="text-3xl font-bold mb-4 text-indigo-600">Why Polygon?</h2>
        <p className="text-lg leading-relaxed">
          Polygon offers fast transactions, low fees, and strong compatibility with Ethereum tooling,
          which matters for a game that needs smooth gameplay loops and frequent interactions. It helps
          keep participation practical for everyday players.
        </p>
      </section>

      {/* Core Values */}
      <section className="bg-white border-y border-slate-200 py-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6 text-fuchsia-600">Our Core Values</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-pink-600 mb-2">Transparency</h3>
              <p className="text-slate-700">
                Clear rules, verifiable outcomes, and automated distribution. No mystery math, no “trust us.”
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-indigo-600 mb-2">Fairness</h3>
              <p className="text-slate-700">
                All cards have equal odds. No pay-to-win mechanics, ever. Fairness is foundational.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-fuchsia-600 mb-2">Community</h3>
              <p className="text-slate-700">
                Built alongside players and creators, with room for partnerships, events, and real-world adoption.
              </p>
            </div>
          </div>
        </div>
      </section>
{/* Team & Community */}
<div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
  <a
    href="/join-community"
    className="inline-block rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-8 py-4 shadow hover:shadow-lg transition"
  >
    Join the Community
  </a>

  <a
    href="/whitepaper"
    className="inline-block rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-8 py-4 shadow hover:shadow-lg transition"
  >
    Read the Whitepaper
  </a>
</div>

        {/* Footer note */}
        <div className="mt-10 text-center text-sm text-slate-500">
          © 2025 NFTBingo • Built on Polygon • nftbingo.net
        </div>

      
    </main>
  );
}
