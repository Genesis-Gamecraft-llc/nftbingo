import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));

  const adminPassword = process.env.NFTBINGO_ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: "Server missing NFTBINGO_ADMIN_PASSWORD" }, { status: 500 });
  }

  if (password !== adminPassword) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });

  // IMPORTANT: secure cookies don't work on http://localhost
  const secure = process.env.NODE_ENV === "production";

  res.cookies.set("nftbingo_admin", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });

  return res;
}
