export default function RoadmapPage() {
  const milestones = [
    {
      phase: "Phase 1",
      title: "MVP Launch",
      desc: "Initial game engine, NFT minting, and foundational gameplay mechanics.",
    },
    {
      phase: "Phase 2",
      title: "Token Integration",
      desc: "Launch of the BINGO token, staking rewards, and jackpot events.",
    },
    {
      phase: "Phase 3",
      title: "Mobile Expansion",
      desc: "Mobile-optimized gameplay and wallet integration for iOS/Android.",
    },
    {
      phase: "Phase 4",
      title: "DAO Governance",
      desc: "Introduce player voting, community funding pools, and upgrade proposals.",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100 px-6 py-16">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-10 bg-clip-text text-transparent bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600">
          Roadmap
        </h1>

        <p className="text-lg text-slate-700 mb-12">
          Our roadmap outlines the evolution of NFTBingo—from concept to global community.
          Each phase focuses on growth, transparency, and long-term sustainability.
        </p>

        <div className="space-y-8">
          {milestones.map((m, i) => (
            <div
              key={i}
              className="bg-white shadow rounded-xl p-6 text-left border-l-4 border-pink-600 hover:shadow-md transition"
            >
              <h2 className="text-2xl font-bold text-pink-600">{m.phase}</h2>
              <h3 className="text-lg font-semibold text-slate-900">{m.title}</h3>
              <p className="text-slate-700 mt-2">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}