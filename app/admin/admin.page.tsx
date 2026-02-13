"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });

    setLoading(false);

    if (!res.ok) {
      setErr("Invalid password");
      return;
    }

    router.push("/play");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-white shadow rounded-2xl p-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Admin Login</h1>
        <p className="text-sm text-slate-600 mt-1">Enter the admin password to run games.</p>

        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Admin password"
        />

        {err && <div className="mt-3 text-sm text-rose-700">{err}</div>}

        <button
          type="submit"
          disabled={loading || !pw}
          className="mt-4 w-full rounded-xl bg-slate-900 text-white font-semibold px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
