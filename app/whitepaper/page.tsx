"use client";

import React from "react";

export default function WhitepaperPage() {
  const handleDownload = async () => {
    try {
      console.log("🟢 Starting PDF generation...");

      // Dynamically import client-only libraries
      const jsPDF = (await import("jspdf")).default;
      const html2canvas = (await import("html2canvas")).default;
      console.log("✅ Libraries loaded successfully");

      const element = document.getElementById("whitepaper-content");
      if (!element) {
        alert("Could not find whitepaper content on the page.");
        return;
      }

      console.log("🟡 Capturing element with html2canvas...");

      // Cast the options to `any` to bypass outdated type definitions
      const options: any = {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc: Document) => {
          clonedDoc.querySelectorAll("*").forEach((el) => {
            const style = window.getComputedStyle(el as HTMLElement);
            if (style.backgroundImage.includes("gradient")) {
              (el as HTMLElement).style.backgroundImage = "none";
              (el as HTMLElement).style.backgroundColor = "#ffffff";
            }
          });
        },
      };

      const canvas = await html2canvas(element, options);

      console.log("✅ Canvas captured successfully.");

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      console.log("📄 Adding image to PDF...");
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("NFTBingo-Whitepaper.pdf");

      console.log("✅ PDF saved successfully.");
    } catch (error) {
      console.error("🚨 Full PDF generation error:", error);
      alert(
        "Something went wrong generating the PDF. Please check the browser console for details."
      );
    }
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
            type="button"
            className="cursor-pointer bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300"
          >
            Download PDF
          </button>
        </div>

        {/* Whitepaper Content */}
        <div
          id="whitepaper-content"
          className="bg-white rounded-2xl shadow p-8 leading-relaxed text-slate-700"
        >
          <p className="text-lg mb-6">
            <strong>NFTBingo</strong> is a blockchain-powered online gaming
            platform where players purchase and use{" "}
            <strong>NFT-based bingo cards</strong> to compete in verifiably
            fair, decentralized bingo games. The platform is built on{" "}
            <strong>Polygon</strong> for scalability, speed, and low fees.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-pink-600">
            Overview
          </h2>
          <p className="mb-6">
            NFTBingo combines the fun and familiarity of bingo with blockchain
            transparency. Players acquire unique NFT cards to join live games,
            trade, or stake them for passive income.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-indigo-600">
            Token Utility
          </h2>
          <ul className="list-disc list-inside space-y-2 mb-6">
            <li>Used for bingo game entry fees (USD-pegged pricing model).</li>
            <li>Rewards from winning games and special jackpot events.</li>
            <li>Governance participation for future platform updates.</li>
            <li>
              Staking system where NFT card owners earn passive rewards.
            </li>
          </ul>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-fuchsia-600">
            Gameplay Mechanics
          </h2>
          <p className="mb-6">
            Each game has a required minimum number of players before starting.
            Once the threshold is met, a countdown begins. Numbers are drawn
            randomly on-chain, and winners are automatically verified through
            smart contract execution.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-pink-600">
            NFT Card Ownership
          </h2>
          <p className="mb-6">
            Each NFT card has a unique on-chain pattern hash and limited supply.
            Players may use their card in one game at a time or stake it to
            allow others to play with it. Staked cards earn a share of winnings
            based on staking terms.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-indigo-600">
            Revenue Model
          </h2>
          <p className="mb-6">
            NFTBingo earns revenue through small fees on every game entry and
            payout. Additional income streams include NFT minting, staking
            commissions, and resale royalties.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-fuchsia-600">
            Roadmap Highlights
          </h2>
          <ul className="list-disc list-inside space-y-2 mb-10">
            <li>
              <strong>Phase 1:</strong> MVP launch with basic game engine and
              NFT minting.
            </li>
            <li>
              <strong>Phase 2:</strong> Token launch, staking marketplace, and
              jackpot modes.
            </li>
            <li>
              <strong>Phase 3:</strong> Mobile app release and cross-chain
              interoperability.
            </li>
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
