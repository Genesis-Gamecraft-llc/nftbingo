// app/api/metadata/[tokenId]/route.ts

import { NextResponse } from "next/server";
import { getCardData } from "@/lib/cardGenerator/fetchOnchain";

// Next.js 16: params is a Promise and must be awaited
type RouteContext = {
  params: Promise<{
    tokenId: string;
  }>;
};

/**
 * NFT metadata endpoint for a given tokenId.
 *
 * Example: /api/metadata/1
 * Shape is OpenSea-compatible.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { tokenId } = await context.params; // ✅ unwrap params
    const tokenIdNum = Number(tokenId);

    if (!Number.isFinite(tokenIdNum) || tokenIdNum < 1) {
      return NextResponse.json(
        { ok: false, message: "Invalid tokenId." },
        { status: 400 }
      );
    }

    // Figure out our base URL (works for localhost AND deployed)
    const url = new URL(request.url);
    const origin = url.origin;

    // 1) Fetch on-chain data (numbers + backgroundId)
    const onchain = await getCardData(tokenIdNum);

    // 2) Build image URL that points to our card-image endpoint
    const imageUrl = `${origin}/api/card-image/${tokenIdNum}`;

    // 3) Build OpenSea-style metadata JSON
    const metadata = {
      name: `NFTBingo Card #${tokenIdNum}`,
      description:
        "An on-chain bingo card from NFTBingo on the Polygon Amoy test network. Numbers and background are generated and stored on-chain.",
      image: imageUrl,
      external_url: origin,
      attributes: [
        {
          trait_type: "Background ID",
          value: onchain.backgroundId,
        },
        {
          trait_type: "Numbers",
          value: onchain.numbers.join(", "),
        },
      ],
    };

    return NextResponse.json(metadata, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=86400",
      },
    });
  } catch (error: any) {
    console.error("❌ Error in /api/metadata/[tokenId]:", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          error?.message ??
          "Unexpected error while generating metadata for this token.",
      },
      { status: 500 }
    );
  }
}
