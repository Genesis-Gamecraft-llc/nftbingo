import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies(); // <-- await is required on newer Next versions
  const isAdmin = cookieStore.get("nftbingo_admin")?.value === "1";
  return NextResponse.json({ isAdmin });
}
