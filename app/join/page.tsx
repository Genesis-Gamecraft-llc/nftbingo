export default function JoinPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100 flex flex-col items-center py-16 px-6">
      <div className="max-w-3xl w-full text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600">
          Join the NFTBingo Mailing List
        </h1>

        <p className="text-slate-600 mb-10 text-lg">
          Be the first to know about token sales, new game launches, and early NFT drops.
          We’ll never spam you — just the good stuff.
        </p>

        <div className="rounded-2xl border border-slate-200 shadow-lg bg-white p-4 md:p-8">
          <iframe
            src="https://docs.google.com/forms/d/e/1FAIpQLScKMkFOb1cuG_39BS1zENK6UkGKZ2y-qswqB27E9VU7csoWYg/viewform?embedded=true"
            className="w-full h-[80vh] md:h-[1000px] rounded-xl"
            style={{ border: "none", overflow: "hidden" }}
          >
            Loading…
          </iframe>
        </div>

        <p className="text-xs text-slate-400 mt-6 italic">
          By signing up, you agree to receive updates and promotional messages from NFTBingo.
        </p>
      </div>
    </main>
  );
}
