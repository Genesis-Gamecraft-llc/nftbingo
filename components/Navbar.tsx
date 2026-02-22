"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import SolanaConnectButton from "./SolanaConnectButton";

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const infoItems = [
    { name: "About", href: "/about" },
    { name: "Whitepaper", href: "/whitepaper" },
    { name: "Roadmap", href: "/roadmap" },
    { name: "Blog", href: "/blog" },
  ];

  // Mobile menu stays flat. Desktop uses the Info dropdown.
  const mobileNavItems = [
    { name: "Home", href: "/" },
    ...infoItems,
    { name: "Join Community", href: "/join-community" },
  ];

  return (
    <nav className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm fixed top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
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

        {/* Desktop nav (centered) */}
        <div className="hidden md:flex flex-1 items-center justify-center gap-8">
          <Link
            href="/"
            className={`font-medium ${
              pathname === "/"
                ? "text-pink-600 border-b-2 border-pink-500"
                : "text-slate-700 hover:text-pink-600"
            }`}
          >
            Home
          </Link>

          {/* Info dropdown (hover-friendly) */}
          <div className="relative group">
            <button
              type="button"
              className={`font-medium ${
                pathname.startsWith("/about") ||
                pathname.startsWith("/whitepaper") ||
                pathname.startsWith("/roadmap") ||
                pathname.startsWith("/blog")
                  ? "text-pink-600 border-b-2 border-pink-500"
                  : "text-slate-700 hover:text-pink-600"
              }`}
            >
              Info
            </button>

            {/* Hover bridge so menu doesn’t vanish while moving mouse down */}
            <div className="absolute left-0 top-full h-3 w-full" />

            <div className="absolute left-1/2 top-full z-50 hidden w-52 -translate-x-1/2 pt-2 group-hover:block group-focus-within:block">
              <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                {infoItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`block px-4 py-2 text-sm font-medium ${
                      pathname === item.href
                        ? "text-pink-600 bg-pink-50"
                        : "text-slate-700 hover:text-pink-600 hover:bg-slate-50"
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <Link
            href="/join-community"
            className={`font-medium ${
              pathname === "/join-community"
                ? "text-pink-600 border-b-2 border-pink-500"
                : "text-slate-700 hover:text-pink-600"
            }`}
          >
            Join Community
          </Link>
        </div>

        {/* Desktop right-side CTAs */}
        <div className="hidden md:flex items-center gap-4 flex-shrink-0">
          <Link
            href="/mint"
            className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:scale-105 transition"
          >
            Mint Cards
          </Link>

          <Link
            href="/play"
            className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:scale-105 transition"
          >
            Play NFTBingo
          </Link>

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
            {mobileNavItems.map((item) => (
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
              href="/mint"
              onClick={() => setMenuOpen(false)}
              className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:scale-105 transition"
            >
              Mint Cards
            </Link>

            <Link
              href="/play"
              onClick={() => setMenuOpen(false)}
              className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:scale-105 transition"
            >
              Play NFTBingo
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}