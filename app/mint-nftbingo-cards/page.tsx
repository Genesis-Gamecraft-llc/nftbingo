"use client";

import React from "react";

export default function MintNFTBingoCardsPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero Gradient (matches site feel like your Home hero) */}
      <section className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500">
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white">
            Mint Cards
          </h1>

          <p className="mt-4 text-white/90 max-w-3xl mx-auto text-lg">
            Minting is temporarily paused while we transition from Devnet testing
            to the live mainnet mint.
          </p>
        </div>
      </section>

      {/* Content (keeps the same styling vibe as your current mint page) */}
      <section className="max-w-4xl mx-auto py-16 px-4">
        <h2 className="text-3xl font-extrabold text-center mb-4 text-gray-900">
          Check back on February 1st for live minting!
        </h2>

        <p className="text-center text-gray-600 mb-10 max-w-2xl mx-auto">
          The Platinum Tier of the Founders Series NFTBingo cards will go live, releasing the first 100 playable NFTBingo cards, on February 1st at 12 PM CST. Stay tuned for more details!
        </p>

        {/* Main Card (same card look/feel as your devnet mint page) */}
        <div className="bg-white rounded-3xl shadow-lg px-8 py-10 mb-10 border border-pink-100">
          <h3 className="text-2xl font-bold text-center mb-2">
            Minting Temporarily Disabled
          </h3>

          <p className="text-center text-gray-600 mb-6 max-w-xl mx-auto">
            We’ve intentionally disabled Devnet minting to avoid confusion and to
            ensure the next mint you see here is the official live release.
          </p>

          <div className="bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 text-center">
            <p className="text-sm text-gray-700">
              Status:{" "}
              <span className="font-semibold">
                Paused — preparing for live mainnet mint
              </span>
            </p>
          </div>
        </div>

        {/* Secondary Notice */}
        <div className="bg-gray-50 rounded-3xl px-8 py-8 border border-gray-100">
          <h3 className="text-xl font-bold mb-2 text-center">
            What should I do now?
          </h3>
          <p className="text-center text-gray-600 max-w-2xl mx-auto">
            Keep an eye on our announcements and upcoming AMAs for the live mint
            release details.
          </p>
        </div>
      </section>
    </main>
  );
}
