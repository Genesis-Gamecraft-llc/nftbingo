"use client";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100">
      {/* Header */}
      <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
  <div className="flex items-center gap-3">
    {/* Logo */}
    <img
      src="/logoinprogress.png"
      alt="NFT Bingo Logo"
      className="h-20 w-auto"
    />

    {/* Site Title */}
    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
      <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600">
        NFTBingo
      </span>
    </h1>
  </div>
</header>


      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-4xl md:text-6xl font-extrabold leading-tight">
            Bingo on&nbsp;
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600">
              Polygon
            </span>
          </h2>
          <p className="mt-5 text-lg text-slate-600">
            Own NFT bingo cards, join rolling games with USD-pegged buy-ins, and win token or NFT prizes.
            Featured jackpots and player-capped games run 24/7.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="#enter"
              className="rounded-xl bg-indigo-600 px-6 py-3 text-white font-semibold shadow hover:bg-indigo-700"
            >
              Enter App
            </a>
            <a
              href="#whitepaper"
              className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-white"
            >
              View Whitepaper
            </a>
          </div>

          <div className="mt-8 flex items-center gap-3 text-sm text-slate-500">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">🅱️</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">🔵</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">🟡</span>
            <span>…bingo balls, NFTs, and wrapped prizes (wETH / wBTC).</span>
          </div>
        </div>

        {/* Right-side card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="rounded-xl bg-gradient-to-tr from-pink-50 via-fuchsia-50 to-indigo-50 p-6 border border-slate-200">
            <p className="text-sm font-semibold text-slate-600">Next Game Starts In</p>
            <p className="mt-2 text-4xl font-extrabold text-slate-900">02:00</p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg bg-white p-4 border border-slate-200">
                <p className="text-slate-500">Featured Jackpot</p>
                <p className="text-slate-900 font-bold">Player-Capped</p>
              </div>
              <div className="rounded-lg bg-white p-4 border border-slate-200">
                <p className="text-slate-500">Buy-In (USD-pegged)</p>
                <p className="text-slate-900 font-bold">$1.00</p>
              </div>
            </div>
            <button
              className="mt-6 w-full rounded-xl bg-pink-600 px-4 py-3 text-white font-semibold shadow hover:bg-pink-700"
              onClick={() => alert('Join Game (placeholder)')}
            >
              Join Featured Game
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-20">
        <h3 className="text-2xl md:text-3xl font-bold">Why NFTBingo</h3>
        <div className="mt-6 grid md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-lg font-semibold">USD-Pegged Buy-Ins</p>
            <p className="mt-2 text-slate-600">Fair, snapshot-priced entries per block of games.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-lg font-semibold">Player-Capped Modes</p>
            <p className="mt-2 text-slate-600">Smaller lobbies with better odds alongside unlimited games.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-lg font-semibold">Flexible Prizes</p>
            <p className="mt-2 text-slate-600">BINGO token, wETH/wBTC, or NFTs—fully automated payouts.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} NFTBingo • nftbingo.net</p>
          <div className="flex items-center gap-4 text-sm">
            <a href="#" className="text-slate-500 hover:text-slate-900">Terms</a>
            <a href="#" className="text-slate-500 hover:text-slate-900">Privacy</a>
            <a href="#" className="text-slate-500 hover:text-slate-900">Discord</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
