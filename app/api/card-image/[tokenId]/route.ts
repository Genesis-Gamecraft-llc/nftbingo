// app/api/card-image/[tokenId]/route.ts

import { NextResponse } from "next/server";
import { getCardData } from "@/lib/cardGenerator/fetchOnchain";
import { generateCardImage } from "@/lib/cardGenerator/generateImage";

// Next.js 16: params is a Promise and must be awaited
type RouteContext = {
  params: Promise<{
    tokenId: string;
  }>;
};

/**
 * Returns a PNG image for a given tokenId.
 * Example: /api/card-image/1
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { tokenId } = await context.params; // ✅ unwrap params
    const tokenIdNum = Number(tokenId);

    if (!Number.isFinite(tokenIdNum) || tokenIdNum < 1) {
      return NextResponse.json(
        { ok: false, message: "Invalid tokenId." },
        { status: 400 }
      );
    }

    // 1) Fetch on-chain data for this token
    const onchain = await getCardData(tokenIdNum);

    // 2) Render the PNG using our canvas generator
    const pngBuffer = await generateCardImage(
      onchain.numbers,
      onchain.backgroundId
    );

    // TS + Response: just cast to any so types don’t complain
    return new Response(pngBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        // Cache aggressively for public consumers / marketplaces
        "Cache-Control": "public, max-age=0, s-maxage=86400",
      },
    });
  } catch (error: any) {
    console.error("❌ Error in /api/card-image/[tokenId]:", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          error?.message ?? "Unexpected error while generating card image.",
      },
      { status: 500 }
    );
  }
}
