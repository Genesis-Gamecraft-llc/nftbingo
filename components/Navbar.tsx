"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import SolanaConnectButton from "./SolanaConnectButton";

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Whitepaper", href: "/whitepaper" },
    { name: "Roadmap", href: "/roadmap" },
    { name: "Blog", href: "/blog" },
    { name: "Join Community", href: "/join-community" },
  ];

  return (
    <nav className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm fixed top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          <img
            src="/images/NFTBingoLogo.png"
            alt="NFTBingo Logo"
            className="w-14 h-14 object-contain shadow-md"
          />
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-xl sm:text-2xl lg:text-3xl whitespace-nowrap">
            NFTBingo
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8 ml-10">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`font-medium ${
                pathname === item.href
                  ? "text-pink-600 border-b-2 border-pink-500"
                  : "text-slate-700 hover:text-pink-600"
              }`}
            >
              {item.name}
            </Link>
          ))}

          {/* Mint */}
          <Link
            href="/mint"
            className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:scale-105 transition"
          >
            Mint Cards
          </Link>

          {/* Solana Wallet */}
          <SolanaConnectButton />
        </div>

        {/* Mobile right-side wallet */}
        <div className="md:hidden ml-auto mr-3">
          <SolanaConnectButton />
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-slate-700 hover:text-pink-600"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 shadow-lg">
          <div className="flex flex-col items-center py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`font-medium ${
                  pathname === item.href
                    ? "text-pink-600"
                    : "text-slate-700 hover:text-pink-600"
                }`}
              >
                {item.name}
              </Link>
            ))}

            <Link
              href="/mint-nftbingo-cards"
              onClick={() => setMenuOpen(false)}
              className="w-11/12 text-center bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-semibold px-4 py-2 rounded-xl shadow"
            >
              Mint Cards
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
