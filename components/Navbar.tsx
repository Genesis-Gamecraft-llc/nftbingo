"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import SolanaConnectButton from "./SolanaConnectButton";

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Mobile nav (unchanged behavior)
  const navItemsMobile = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Whitepaper", href: "/whitepaper" },
    { name: "Roadmap", href: "/roadmap" },
    { name: "Blog", href: "/blog" },
    { name: "Join Community", href: "/join-community" },
  ];

  // Desktop order: Home → Info → Join Community
  const navItemsDesktop = [
    { name: "Home", href: "/" },
    { name: "Join Community", href: "/join-community" },
  ];

  const infoItems = [
    { name: "About", href: "/about" },
    { name: "Whitepaper", href: "/whitepaper" },
    { name: "Roadmap", href: "/roadmap" },
    { name: "Blog", href: "/blog" },
  ];

  const infoActive = infoItems.some((i) => i.href === pathname);

  const linkClass = (href: string) =>
    `font-medium ${
      pathname === href
        ? "text-pink-600 border-b-2 border-pink-500"
        : "text-slate-700 hover:text-pink-600"
    }`;

  return (
    <nav className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm fixed top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
        
        {/* LOGO — larger + no box */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          <img
            src="/images/NFTBingoLogo.png"
            alt="NFTBingo Logo"
            className="h-20 w-auto object-contain"  // ← bigger, no square, no shadow
          />
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-2xl lg:text-3xl whitespace-nowrap">
            NFTBingo
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8 ml-10">

          {/* Home */}
          <Link href="/" className={linkClass("/")}>
            Home
          </Link>

          {/* Info (SECOND ITEM NOW) */}
          <div className="relative group">
            <span
              className={`font-medium cursor-pointer inline-flex items-center ${
                infoActive
                  ? "text-pink-600 border-b-2 border-pink-500"
                  : "text-slate-700 hover:text-pink-600"
              }`}
            >
              Info
            </span>

            {/* No hover gap */}
            <div className="absolute left-0 top-full hidden group-hover:block z-50 pt-2">
              <div className="bg-white border border-slate-200 shadow-lg rounded-xl py-2 min-w-[200px]">
                {infoItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`block px-4 py-2 font-medium ${
                      pathname === item.href
                        ? "text-pink-600"
                        : "text-slate-700 hover:text-pink-600"
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Join Community (now third) */}
          <Link
            href="/join-community"
            className={linkClass("/join-community")}
          >
            Join Community
          </Link>

          {/* Mint */}
          <Link
            href="/mint"
            className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:scale-105 transition"
          >
            Mint Cards
          </Link>

          {/* Play */}
          <Link
            href="/play"
            className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl shadow hover:scale-105 transition"
          >
            Play NFTBingo
          </Link>

          <SolanaConnectButton />
        </div>

        {/* Mobile wallet */}
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
            {navItemsMobile.map((item) => (
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