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
              // @ts-ignore
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
        pdf.addImage(imgData, "PNG", 0, position + 25, imgWidth, imgHeight - 10);
        heightLeft -= pageHeight - 25;
      }

      pdf.save("NFTBingo-Whitepaper.pdf");
      console.log("✅ PDF saved successfully.");
    } catch (err) {
      console.error("🚨 PDF generation failed:", err);
      alert(
        "Something went wrong while creating your PDF. Check console for details."
      );
    }
  };

  const sections = [
    { label: "Overview", href: "#overview" },
    { label: "Token Utility", href: "#token-utility" },
    { label: "Gameplay", href: "#gameplay" },
    { label: "NFT Ownership", href: "#nft-ownership" },
    { label: "Revenue", href: "#revenue" },
    { label: "Tokenomics", href: "#tokenomics" },
    { label: "Roadmap", href: "#roadmap" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100 px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 text-center">
          NFTBingo Whitepaper
        </h1>

        <p className="text-center text-slate-600 mb-10">
          Everything you need in one place: vision, mechanics, gameplay,and token
          model. Plus a PDF export when you need it.
        </p>

        {/* Download Button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={handleDownload}
            type="button"
            className="cursor-pointer bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
          >
            Download PDF
          </button>
        </div>

        {/* Sticky Subnav */}
        <div className="sticky top-[72px] z-40 mb-8">
          <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-sm px-4 py-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {sections.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  className="whitespace-nowrap text-sm font-semibold px-3 py-2 rounded-xl text-slate-700 hover:text-pink-600 hover:bg-slate-50 transition"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Whitepaper Content (this is what gets captured for PDF) */}
        <div
          id="whitepaper-content"
          className="bg-white rounded-2xl shadow p-8 leading-relaxed text-slate-700"
        >
          <p className="text-lg mb-6">
            <strong>NFTBingo</strong> is a blockchain-powered online gaming platform
            where players purchase and use <strong>NFT-based bingo cards</strong> to
            compete in verifiably fair, decentralized bingo games. The platform is
            built on <strong>Polygon</strong> for scalability, speed, and low fees.
          </p>

          <section id="overview" className="scroll-mt-28">
            <h2 className="text-2xl font-bold mt-10 mb-3 text-pink-600">
              Overview
            </h2>
            <p className="mb-6">
              NFTBingo combines the fun and familiarity of bingo with blockchain
              transparency. Players acquire unique NFT cards to join live games,
              trade, or stake them for passive income.
            </p>
          </section>

          <section id="token-utility" className="scroll-mt-28">
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
          </section>

          <section id="gameplay" className="scroll-mt-28">
            <h2 className="text-2xl font-bold mt-10 mb-3 text-fuchsia-600">
              Gameplay Mechanics
            </h2>
            <p className="mb-6">
              Each game has a required minimum number of players before starting.
              Once the threshold is met, a countdown begins. Numbers are drawn
              randomly on-chain, and winners are automatically verified through smart
              contract execution.
            </p>
          </section>

          <section id="nft-ownership" className="scroll-mt-28">
            <h2 className="text-2xl font-bold mt-10 mb-3 text-pink-600">
              NFT Card Ownership
            </h2>
            <p className="mb-6">
              Each NFT card has a unique on-chain pattern hash and limited supply.
              Players may use their card in one game at a time or stake it to allow
              others to play with it. Staked cards earn a share of winnings based on
              staking terms.
            </p>
          </section>

          <section id="revenue" className="scroll-mt-28">
            <h2 className="text-2xl font-bold mt-10 mb-3 text-indigo-600">
              Revenue Model
            </h2>
            <p className="mb-6">
              NFTBingo earns revenue through small fees on every game entry and
              payout. Additional income streams include NFT minting, staking
              commissions, and resale royalties.
            </p>
          </section>

          {/* Integrated Tokenomics */}
          <section id="tokenomics" className="scroll-mt-28">
            <h2 className="text-2xl font-bold mt-10 mb-3 bg-clip-text text-transparent bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600">
              Tokenomics
            </h2>

            <p className="mb-6">
              The <strong>BINGO Token</strong> powers every transaction and reward on
              the NFTBingo platform. It fuels gameplay, staking, governance, and the
              economy of ownership.
            </p>

            <h3 className="text-xl font-bold text-indigo-600 mt-8 mb-3">
              Token Distribution
            </h3>
            <ul className="list-disc list-inside space-y-2 mb-6">
              <li>40% – Game rewards and player incentives</li>
              <li>20% – Development and ecosystem growth</li>
              <li>20% – Liquidity and staking pools</li>
              <li>10% – Founding team &amp; advisors (vested)</li>
              <li>10% – Community treasury &amp; partnerships</li>
            </ul>

            <h3 className="text-xl font-bold text-fuchsia-600 mt-8 mb-3">
              Deflationary Model
            </h3>
            <p className="mb-6">
              A portion of every game fee is burned to reduce total supply over time,
              ensuring long-term scarcity and value stability. The burn rate
              dynamically adjusts based on network activity and jackpot size.
            </p>
          </section>

          <section id="roadmap" className="scroll-mt-28">
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
          </section>

          <div className="text-center mt-10">
            <a
              href="/"
              className="inline-block bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl shadow hover:shadow-lg transition-all"
            >
              Back to Home
            </a>
          </div>
        </div>

        <p className="mt-10 text-sm text-slate-500 italic text-center">
          Tip: Use the subnav to jump sections, or download the PDF for sharing.
        </p>
      </div>
    </main>
  );
}
