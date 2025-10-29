"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

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
      <div className="max-w-7xl mx-auto flex items-center justify-between px-8 py-4 flex-wrap md:flex-nowrap">
        
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
        <div className="hidden md:flex items-center justify-end gap-6 ml-auto flex-shrink">
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
          <button className="whitespace-nowrap bg-gradient-to-r from-pink-600 to-indigo-600 text-white px-5 py-2 rounded-lg font-semibold hover:shadow-md transition-all">
            Connect Wallet
          </button>
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
            <button className="bg-gradient-to-r from-pink-600 to-indigo-600 text-white px-5 py-2 rounded-lg font-semibold hover:shadow-md whitespace-nowrap">
              Connect Wallet
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
