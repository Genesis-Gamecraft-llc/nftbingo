"use client";

import React from "react";

export default function WhitepaperPage() {
  const handleDownload = async () => {
    try {
      console.log("🟢 Starting PDF generation...");

      const jsPDF = (await import("jspdf")).default;
      const html2canvas = (await import("html2canvas")).default;

      const element = document.getElementById("whitepaper-content");
      if (!element) return alert("Could not find whitepaper content.");

      // --- Clone & sanitize colors for html2canvas ---
      const options: any = {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc: Document) => {
          const nodes = clonedDoc.querySelectorAll("*");
          nodes.forEach((node) => {
            const el = node as HTMLElement;
            const cs = (clonedDoc.defaultView || window).getComputedStyle(el);

            // Remove gradients or unsupported color functions
            const clean = (color: string, fallback: string) =>
              color.includes("lab(") ||
              color.includes("lch(") ||
              color.includes("color(")
                ? fallback
                : color;

            el.style.backgroundColor = clean(cs.backgroundColor, "#ffffff");
            el.style.color = clean(cs.color, "#111827");
            el.style.borderColor = clean(cs.borderColor, "#e5e7eb");

            if (cs.backgroundImage.includes("gradient")) {
              el.style.backgroundImage = "none";
            }

            if (
              cs.backgroundClip === "text" ||
              cs.webkitBackgroundClip === "text"
            ) {
              el.style.backgroundImage = "none";
              el.style.color = "#db2777"; // NFTBingo pink
            }
          });
        },
      };

      // --- Capture image from HTML ---
      const canvas = await html2canvas(element, options);
      const imgData = canvas.toDataURL("image/png");

      // --- Multi-page logic ---
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // --- Header Branding ---
      const addHeader = () => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor("#db2777"); // pink
        pdf.text("NFTBingo Whitepaper", 15, 15);
        try {
          const logo = new Image();
          logo.src = "/logoinprogress.png";
          pdf.addImage(logo, "PNG", pageWidth - 40, 5, 25, 10);
        } catch {
          /* ignore if image fails to load */
        }
      };

      addHeader();
      pdf.addImage(imgData, "PNG", 0, 25, imgWidth, imgHeight - 10);
      heightLeft -= pageHeight - 25;

      // --- Add pages dynamically if content overflows ---
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        addHeader();
        pdf.addImage(
          imgData,
          "PNG",
          0,
          position + 25,
          imgWidth,
          imgHeight - 10
        );
        heightLeft -= pageHeight - 25;
      }

      pdf.save("NFTBingo-Whitepaper.pdf");
      console.log("✅ PDF saved successfully.");
    } catch (err) {
      console.error("🚨 PDF generation failed:", err);
      alert("Something went wrong while creating your PDF. Check console for details.");
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
            <strong>NFT-based bingo cards</strong> to compete in verifiably fair,
            decentralized bingo games. The platform is built on{" "}
            <strong>Polygon</strong> for scalability, speed, and low fees.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-pink-600">Overview</h2>
          <p className="mb-6">
            NFTBingo combines the fun and familiarity of bingo with blockchain
            transparency. Players acquire unique NFT cards to join live games,
            trade, or stake them for passive income.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-indigo-600">Token Utility</h2>
          <ul className="list-disc list-inside space-y-2 mb-6">
            <li>Used for bingo game entry fees (USD-pegged pricing model).</li>
            <li>Rewards from winning games and special jackpot events.</li>
            <li>Governance participation for future platform updates.</li>
            <li>Staking system where NFT card owners earn passive rewards.</li>
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

          <h2 className="text-2xl font-bold mt-10 mb-3 text-pink-600">NFT Card Ownership</h2>
          <p className="mb-6">
            Each NFT card has a unique on-chain pattern hash and limited supply.
            Players may use their card in one game at a time or stake it to allow
            others to play with it. Staked cards earn a share of winnings based on
            staking terms.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3 text-indigo-600">Revenue Model</h2>
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
              <strong>Phase 1:</strong> MVP launch with basic game engine and NFT
              minting.
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
