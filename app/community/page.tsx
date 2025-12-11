export default function CommunityPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100 px-6 py-16 text-center">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600">
          Join Our Community
        </h1>
        <p className="text-lg text-slate-700 mb-10">
          Connect with players, developers, and crypto enthusiasts shaping the future of on-chain gaming.
        </p>

        <div className="flex flex-wrap justify-center gap-6">
          <a href="https://discord.gg/tCWVcG5vnc" className="bg-[#5865F2] text-white px-6 py-3 rounded-xl shadow hover:opacity-90 transition">
            Discord
          </a>
          <a href="https://x.com/0xNFTBingo" className="bg-[#1DA1F2] text-white px-6 py-3 rounded-xl shadow hover:opacity-90 transition">
            Twitter / X
          </a>
          <a href="https://t.me/NFTBingoCommunity" className="bg-[#229ED9] text-white px-6 py-3 rounded-xl shadow hover:opacity-90 transition">
            Telegram
          </a>
        </div>
      </div>
    </main>
  );
}
