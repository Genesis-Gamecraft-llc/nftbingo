"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Whitepaper", href: "/whitepaper" },
    { name: "Tokenomics", href: "/tokenomics" },
    { name: "Roadmap", href: "/roadmap" },
    { name: "Community", href: "/community" },
    { name: "Join", href: "/join" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-8 py-4">
        {/* Logo + Title */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          <img
            src="/logoinprogress.png"
            alt="NFT Bingo Logo"
            className="h-14 md:h-16 w-auto drop-shadow-md"
          />
          <span className="hidden md:inline font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-2xl lg:text-3xl tracking-tight whitespace-nowrap">
            NFTBingo
          </span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center justify-end gap-8 ml-10 flex-shrink">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`font-medium transition-all ${
                pathname === item.href
                  ? "text-pink-600 border-b-2 border-pink-500"
                  : "text-slate-700 hover:text-pink-600"
              }`}
            >
              {item.name}
            </Link>
          ))}

          {/* Mint Button (desktop) – gradient, single line */}
          <Link
            href="/mint-nftbingo-cards"
            className="cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
          >
            Mint NFTBingo Cards
          </Link>

          {/* Connect Wallet Button (desktop) – same gradient style, single line */}
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              authenticationStatus,
              mounted,
            }) => {
              const ready =
                mounted && authenticationStatus !== "loading";
              const connected =
                ready &&
                account &&
                chain &&
                (!authenticationStatus ||
                  authenticationStatus === "authenticated");

              if (!ready) {
                return (
                  <div
                    aria-hidden="true"
                    style={{
                      opacity: 0,
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    <button
                      type="button"
                      className="cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow transition-all duration-300 whitespace-nowrap"
                    >
                      Connect Wallet
                    </button>
                  </div>
                );
              }

              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className="cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain?.unsupported) {
                return (
                  <button
                    type="button"
                    onClick={openChainModal}
                    className="cursor-pointer bg-gradient-to-r from-rose-600 to-red-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <button
                  type="button"
                  onClick={openAccountModal}
                  className="cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
                >
                  {account?.displayName ?? "Wallet"}
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-slate-700 hover:text-pink-600 ml-auto"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 shadow-lg">
          <div className="flex flex-col items-center py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`font-medium ${
                  pathname === item.href
                    ? "text-pink-600"
                    : "text-slate-700 hover:text-pink-600"
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}

            {/* Mint Button (mobile) – gradient */}
            <Link
              href="/mint-nftbingo-cards"
              className="w-11/12 text-center cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:shadow-lg transition-all duration-300"
              onClick={() => setMenuOpen(false)}
            >
              Mint NFTBingo Cards
            </Link>

            {/* Connect Wallet Button (mobile) – same gradient style */}
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
              }) => {
                const ready =
                  mounted && authenticationStatus !== "loading";
                const connected =
                  ready &&
                  account &&
                  chain &&
                  (!authenticationStatus ||
                    authenticationStatus === "authenticated");

                if (!ready) {
                  return (
                    <div
                      aria-hidden="true"
                      style={{
                        opacity: 0,
                        pointerEvents: "none",
                        userSelect: "none",
                      }}
                    >
                      <button
                        type="button"
                        className="w-11/12 text-center cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow transition-all duration-300"
                      >
                        Connect Wallet
                      </button>
                    </div>
                  );
                }

                if (!connected) {
                  return (
                    <button
                      type="button"
                      onClick={openConnectModal}
                      className="w-11/12 text-center cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300"
                    >
                      Connect Wallet
                    </button>
                  );
                }

                if (chain?.unsupported) {
                  return (
                    <button
                      type="button"
                      onClick={openChainModal}
                      className="w-11/12 text-center cursor-pointer bg-gradient-to-r from-rose-600 to-red-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300"
                    >
                      Wrong network
                    </button>
                  );
                }

                return (
                  <button
                    type="button"
                    onClick={openAccountModal}
                    className="w-11/12 text-center cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300"
                  >
                    {account?.displayName ?? "Wallet"}
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      )}
    </nav>
  );
}
