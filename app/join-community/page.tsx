export default function JoinCommunityPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100 flex flex-col items-center py-16 px-6">
      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600">
            Join the NFTBingo Community
          </h1>

          <p className="text-slate-600 text-lg max-w-3xl mx-auto">
            Connect with players and builders — and get early updates on token sales,
            new game launches, and NFT drops.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          {/* Left: Mailing list */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 shadow-lg bg-white p-4 md:p-8">
              <h2 className="text-2xl md:text-3xl font-extrabold mb-3 text-slate-900">
                Get on the Mailing List
              </h2>
              <p className="text-slate-600 mb-6">
                We’ll never spam you — just the good stuff.
              </p>

              <iframe
                src="https://docs.google.com/forms/d/e/1FAIpQLScKMkFOb1cuG_39BS1zENK6UkGKZ2y-qswqB27E9VU7csoWYg/viewform?embedded=true"
                className="w-full h-[80vh] md:h-[1000px] rounded-xl"
                style={{ border: "none", overflow: "hidden" }}
              >
                Loading…
              </iframe>
            </div>
          </div>

          {/* Right: Social + Discord widget */}
          <aside className="flex justify-center lg:justify-end">
            <div className="w-[350px] flex flex-col gap-4">
              {/* Social buttons stacked */}
              
              <a
                href="https://x.com/0xNFTBingo"
                className="bg-[#1DA1F2] text-white px-6 py-3 rounded-xl shadow hover:opacity-90 transition font-semibold text-center"
              >
                Follow on X
              </a>

              <a
                href="https://t.me/NFTBingoCommunity"
                className="bg-[#229ED9] text-white px-6 py-3 rounded-xl shadow hover:opacity-90 transition font-semibold text-center"
              >
                Join Telegram
              </a>

              <a
                href="https://discord.gg/tCWVcG5vnc"
                className="bg-[#5865F2] text-white px-6 py-3 rounded-xl shadow hover:opacity-90 transition font-semibold text-center"
              >
                Join Discord
              </a>

              {/* Discord Widget */}
              <iframe
                src="https://discord.com/widget?id=1434791638508507197&theme=dark"
                width="350"
                height="500"
                frameBorder="0"
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                className="rounded-xl shadow-lg border border-slate-200"
              ></iframe>
            </div>
          </aside>
        </div>

        <p className="text-xs text-slate-400 mt-10 text-center italic">
          By signing up, you agree to receive updates and promotional messages from NFTBingo.
        </p>
      </div>
    </main>
  );
}
