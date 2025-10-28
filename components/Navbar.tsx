"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Whitepaper", href: "/whitepaper" },
    { name: "Tokenomics", href: "/tokenomics" },
    { name: "Roadmap", href: "/roadmap" },
    { name: "Community", href: "/community" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <img src="/logoinprogress.png" alt="NFT Bingo Logo" className="h-10 w-auto" />
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 text-lg">
            NFTBingo
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex gap-6">
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
        </div>

        {/* Connect Wallet (placeholder for now) */}
        <button className="hidden md:block bg-gradient-to-r from-pink-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:shadow-md">
          Connect Wallet
        </button>
      </div>
    </nav>
  );
}
