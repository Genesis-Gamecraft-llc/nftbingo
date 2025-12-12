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
    { name: "Join Community", href: "/join-community" },
  ];

  return (
    <nav className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm fixed top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
        {/* Logo & Brand */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          <img
            src="/images/NFTBingoLogo.png"
            alt="NFTBingo Logo"
            className="w-10 h-10 rounded-full shadow-md"
          />
          {/* Show name on mobile too */}
          <span className="inline font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-xl sm:text-2xl lg:text-3xl tracking-tight whitespace-nowrap">
            NFTBingo
          </span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center justify-end gap-8 ml-10 flex-shrink">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`font-medium transition-all whitespace-nowrap ${
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
            className="cursor-pointer bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
                    >
            Mint Cards
          </Link>

          {/* Wallet Button (desktop) */}
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openConnectModal,
              openChainModal,
              mounted,
            }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div
                  aria-hidden={!ready}
                  style={{
                    opacity: ready ? 1 : 0,
                    pointerEvents: ready ? "auto" : "none",
                    userSelect: ready ? "auto" : "none",
                  }}
                >
                  {!connected ? (
                    <button
                      onClick={openConnectModal}
                      className="cursor-pointer bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
                    >
                      Connect Wallet
                    </button>
                  ) : chain.unsupported ? (
                    <button
                      onClick={openChainModal}
                      className="cursor-pointer bg-red-500 text-white font-semibold px-4 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
                    >
                      Wrong network
                    </button>
                  ) : (
                    <button
                      onClick={openAccountModal}
                      className="cursor-pointer bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
                    >
                      {account?.displayName ?? "Wallet"}
                    </button>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>

        {/* Mobile Wallet Button (stays visible in top bar) */}
        <div className="md:hidden ml-auto mr-3">
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openConnectModal,
              openChainModal,
              mounted,
            }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div
                  aria-hidden={!ready}
                  style={{
                    opacity: ready ? 1 : 0,
                    pointerEvents: ready ? "auto" : "none",
                    userSelect: ready ? "auto" : "none",
                  }}
                >
                  {!connected ? (
                    <button
                      onClick={openConnectModal}
                      className="cursor-pointer bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-3 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
                    >
                      Connect
                    </button>
                  ) : chain.unsupported ? (
                    <button
                      onClick={openChainModal}
                      className="cursor-pointer bg-red-500 text-white font-semibold px-3 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
                    >
                      Wrong
                    </button>
                  ) : (
                    <button
                      onClick={openAccountModal}
                      className="cursor-pointer bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white font-semibold px-3 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
                    >
                      {account?.displayName ?? "Wallet"}
                    </button>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-slate-700 hover:text-pink-600"
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
                className={`font-medium whitespace-nowrap ${
                  pathname === item.href
                    ? "text-pink-600"
                    : "text-slate-700 hover:text-pink-600"
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}

            {/* Mint Button (mobile) */}
            <Link
              href="/mint-nftbingo-cards"
              className="w-11/12 text-center cursor-pointer bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:shadow-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
              onClick={() => setMenuOpen(false)}
            >
              Mint Cards
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
