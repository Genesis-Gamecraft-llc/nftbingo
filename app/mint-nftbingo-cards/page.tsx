import MintWithEthers from "@/components/MintWithEthers";

export default function MintNFTBingoCardsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-16">
        {/* Page title */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-4">
          Mint NFTBingo Cards
        </h1>

        <p className="text-center text-slate-600 max-w-2xl mx-auto mb-12">
          Mint a random, on-chain NFTBingo card on the Polygon Amoy test
          network. Each click mints a new card and then renders the full PNG
          using the numbers and background stored in your smart contract.
        </p>

        {/* Step 1 card */}
        <section className="bg-white rounded-3xl shadow-lg p-8 md:p-10">
          {/* 👇 This is now centered like the rest of the page */}
          <h2 className="text-2xl md:text-3xl font-semibold text-center mb-4">
            Step 1 — Mint &amp; Generate Your Card
          </h2>

          <p className="text-center text-slate-600 max-w-2xl mx-auto mb-8">
            Clicking this button will mint a brand new NFTBingo card to your
            connected wallet, then render the card using the on-chain numbers.
            There is no preview step — each mint is final.
          </p>

          <div className="flex justify-center mb-6">
            <MintWithEthers />
          </div>
        </section>

        {/* Step 2 / metadata blurb */}
        <section className="mt-10 text-center">
          <h3 className="text-xl md:text-2xl font-semibold mb-2">
            Next — Metadata &amp; Secondary Markets
          </h3>
          <p className="text-slate-600 max-w-2xl mx-auto">
            With minting and card rendering wired up, the next steps will be
            wiring your metadata endpoint so marketplaces like OpenSea or
            Rarible show the same image, and then polishing the UX around minted
            cards.
          </p>
        </section>
      </div>
    </main>
  );
}
