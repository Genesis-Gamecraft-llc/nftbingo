"use client";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import React from "react";

export default function WhitepaperPage() {
  const handleDownload = async () => {
    const element = document.getElementById("whitepaper-content");
    if (!element) return;

    const canvas = await html2canvas(element, { scale: 2 } as any);
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
    pdf.save("NFTBingo-Whitepaper.pdf");
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100 px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-8 text-center">
          NFTBingo Whitepaper
        </h1>

        {/* Download Button */}
        <div className="flex justify-center mb-10">
          <button
            onClick={handleDownload}
            className="bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl shadow hover:shadow-lg transition-all"
          >
            Download PDF
          </button>
        </div>

        {/* Whitepaper Content */}
        <div id="whitepaper-content" className="bg-white rounded-2xl shadow p-8">
          <p className="text-lg text-slate-700 leading-relaxed mb-6">
            <strong>NFTBingo</strong> is a blockchain-powered online gaming platform where players purchase and
            use <strong>NFT-based bingo cards</strong> to compete in verifiably fair, decentralized bingo games.
            The platform is built on the <strong>Polygon</strong> network for scalability, speed, and low fees.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-pink-600">Overview</h2>
          <p className="text-slate-700 mb-6 leading-relaxed">
            NFTBingo combines the fun and familiarity of bingo with blockchain transparency. Players acquire
            unique NFT cards to join live games, trade, or stake them for passive income.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-indigo-600">Token Utility</h2>
          <ul className="list-disc list-inside text-slate-700 space-y-2 mb-6">
            <li>Used for bingo game entry fees (USD-pegged pricing model).</li>
            <li>Rewards from winning games and special jackpot events.</li>
            <li>Governance participation for future platform updates.</li>
            <li>Staking system where NFT card owners earn passive rewards.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-fuchsia-600">Gameplay Mechanics</h2>
          <p className="text-slate-700 mb-6 leading-relaxed">
            Each game has a required minimum number of players before starting. Once the threshold is met,
            a countdown begins. Numbers are drawn randomly on-chain, and winners are automatically verified
            through smart contract execution.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-pink-600">NFT Card Ownership</h2>
          <p className="text-slate-700 mb-6 leading-relaxed">
            Each NFT card has a unique on-chain pattern hash and limited total supply. Players may use their
            card in one game at a time or stake it to allow others to play with it. Staked cards earn a share
            of winnings based on pre-agreed staking terms.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-indigo-600">Revenue Model</h2>
          <p className="text-slate-700 mb-6 leading-relaxed">
            NFTBingo earns revenue through a small fee on every game entry and payout.
            Additional income streams include NFT minting, staking commissions, and resale royalties.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-fuchsia-600">Roadmap Highlights</h2>
          <ul className="list-disc list-inside text-slate-700 space-y-2 mb-10">
            <li><strong>Phase 1:</strong> MVP launch with basic game engine and NFT minting.</li>
            <li><strong>Phase 2:</strong> Token launch, staking marketplace, and jackpot modes.</li>
            <li><strong>Phase 3:</strong> Mobile app release and cross-chain interoperability.</li>
          </ul>

          <div className="text-center mt-10">
            <a
              href="/"
              className="inline-block bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl shadow hover:shadow-lg transition-all"
            >
              Back to Home
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
