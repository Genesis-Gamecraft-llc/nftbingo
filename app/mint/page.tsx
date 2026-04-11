"use client";

import React from "react";
import Link from "next/link";

export default function MintPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100 px-6 py-16 md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 px-8 py-10 text-white">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] opacity-90">
              NFTBingo Mint
            </p>
            <h1 className="text-4xl font-extrabold md:text-5xl">
              Minting Temporarily Paused
            </h1>
            <p className="mt-4 max-w-3xl text-base text-white/90 md:text-lg">
              We have temporarily paused minting while we perform wallet and
              upload-flow maintenance. This is a precautionary step to protect
              the platform and make sure everything is working correctly before
              minting resumes.
            </p>
          </div>

          <div className="grid gap-8 px-8 py-10 md:grid-cols-[1.2fr_0.8fr]">
            <section>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="text-xl font-bold text-slate-900">
                  What this means right now
                </h2>
                <ul className="mt-4 space-y-3 text-slate-700">
                  <li>• New mints are currently disabled.</li>
                  <li>• Existing cards and site features are unaffected.</li>
                  <li>
                    • We will reopen minting as soon as maintenance is complete.
                  </li>
                </ul>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-lg font-semibold text-slate-900">
                  Why minting is paused
                </h3>
                <p className="mt-3 text-slate-700">
                  We are reviewing the mint pipeline and storage funding flow to
                  ensure minting remains reliable and secure. Pausing now helps
                  prevent failed mints and protects platform funds while testing
                  is underway.
                </p>
              </div>
            </section>

            <aside>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900">
                  Stay connected
                </h3>
                <p className="mt-3 text-slate-700">
                  Follow updates through the site and community channels. We’ll
                  announce as soon as minting is live again.
                </p>

                <div className="mt-6 flex flex-col gap-3">
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
                  >
                    Return to Homepage
                  </Link>

                  <Link
                    href="/whitepaper"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    View Whitepaper
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}