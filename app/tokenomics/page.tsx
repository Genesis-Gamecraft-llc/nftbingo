export default function TokenomicsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100 px-6 py-16">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-10 bg-clip-text text-transparent bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600">
          Tokenomics
        </h1>

        <p className="text-lg text-slate-700 mb-8">
          The <strong>BINGO Token</strong> powers every transaction and reward on the NFTBingo
          platform. It fuels gameplay, staking, governance, and the economy of ownership.
        </p>

        <div className="bg-white rounded-2xl shadow p-8 text-left border border-slate-200">
          <h2 className="text-2xl font-bold text-pink-600 mb-4">Token Utility</h2>
          <ul className="list-disc list-inside space-y-3 text-slate-700">
            <li>Entry fees for bingo games (USD-pegged buy-ins).</li>
            <li>Reward payouts for winners and jackpots.</li>
            <li>Governance participation for protocol upgrades.</li>
            <li>Staking rewards for NFT card owners and liquidity providers.</li>
          </ul>

          <h2 className="text-2xl font-bold text-indigo-600 mt-10 mb-4">
            Token Distribution
          </h2>
          <ul className="list-disc list-inside space-y-3 text-slate-700">
            <li>40% – Game rewards and player incentives</li>
            <li>20% – Development and ecosystem growth</li>
            <li>20% – Liquidity and staking pools</li>
            <li>10% – Founding team & advisors (vested)</li>
            <li>10% – Community treasury & partnerships</li>
          </ul>

          <h2 className="text-2xl font-bold text-fuchsia-600 mt-10 mb-4">Deflationary Model</h2>
          <p className="text-slate-700 leading-relaxed">
            A portion of every game fee is burned to reduce total supply over time,
            ensuring long-term scarcity and value stability. The burn rate dynamically
            adjusts based on network activity and jackpot size.
          </p>
        </div>

        <p className="mt-12 text-sm text-slate-500 italic">
          NFTBingo operates on the Polygon network for fast, low-cost, and eco-friendly transactions.
        </p>
      </div>
    </main>
  );
}
