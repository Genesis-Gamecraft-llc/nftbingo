"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import SolanaConnectButton from "./SolanaConnectButton";

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Desktop Info dropdown hover state (prevents "disappears before I can click")
  const [infoOpen, setInfoOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const openInfo = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setInfoOpen(true);
  };

  const closeInfo = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setInfoOpen(false), 140);
  };

  // Mobile keeps full list
  const navItemsMobile = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Whitepaper", href: "/whitepaper" },
    { name: "Roadmap", href: "/roadmap" },
    { name: "Blog", href: "/blog" },
    { name: "Join Community", href: "/join-community" },
  ];

  // Info dropdown items
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
      {/* Desktop uses 3-column GRID so nav is centered without "dead space" */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* DESKTOP */}
        <div className="hidden md:grid items-center grid-cols-[auto,1fr,auto] gap-6">
          {/* LEFT: Logo */}
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/images/NFTBingoLogo.png"
              alt="NFTBingo Logo"
              className="h-20 w-auto object-contain"
            />
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-xl sm:text-2xl lg:text-3xl whitespace-nowrap">
              NFTBingo
            </span>
          </Link>

          {/* CENTER: Nav takes full middle column, centered within it */}
          <div className="flex justify-center">
            <div className="flex items-center gap-8">
              <Link href="/" className={linkClass("/")}>
                Home
              </Link>

              <div
                className="relative"
                onMouseEnter={openInfo}
                onMouseLeave={closeInfo}
              >
                <button
                  type="button"
                  className={`font-medium cursor-pointer inline-flex items-center ${
                    infoActive
                      ? "text-pink-600 border-b-2 border-pink-500"
                      : "text-slate-700 hover:text-pink-600"
                  }`}
                  aria-haspopup="menu"
                  aria-expanded={infoOpen}
                >
                  Info
                </button>

                {infoOpen && (
                  <div className="absolute left-0 top-full z-50 pt-2">
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
                          onClick={() => setInfoOpen(false)}
                        >
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Link
                href="/join-community"
                className={linkClass("/join-community")}
              >
                Join Community
              </Link>
            </div>
          </div>

          {/* RIGHT: Buttons + Wallet */}
          <div className="flex items-center gap-4">
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
        </div>

        {/* MOBILE (unchanged layout logic) */}
        <div className="md:hidden flex items-center">
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <img
              src="/images/NFTBingoLogo.png"
              alt="NFTBingo Logo"
              className="h-16 w-auto object-contain"
            />
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-xl whitespace-nowrap">
              NFTBingo
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <SolanaConnectButton />
            <button
              className="text-slate-700 hover:text-pink-600"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
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