import { NextResponse } from "next/server";
import { getCardData } from "@/lib/cardGenerator/fetchOnchain";
import { generateCardImage } from "@/lib/cardGenerator/generateImage";

/**
 * Card generator API (image + on-chain data).
 *
 * - Reads tokenId from the query string (default: 1)
 * - Fetches that card's numbers + backgroundId from your NFTBingo contract
 * - Uses @napi-rs/canvas to render a PNG card image
 * - Returns on-chain data + a base64 data URL of the PNG
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenIdParam = searchParams.get("tokenId");

    const tokenId = tokenIdParam ? Number(tokenIdParam) : 1;

    if (Number.isNaN(tokenId) || tokenId < 1) {
      return NextResponse.json(
        {
          ok: false,
          message: "Invalid tokenId. Must be a positive number.",
        },
        { status: 400 }
      );
    }

    // 1) Fetch on-chain numbers + backgroundId
    const onchain = await getCardData(tokenId);

    // 2) Render PNG image buffer from those values
    const pngBuffer = await generateCardImage(
      onchain.numbers,
      onchain.backgroundId
    );

    // 3) Convert to base64 data URL so the frontend can show it in an <img>
    const base64 = pngBuffer.toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    return NextResponse.json({
      ok: true,
      message: "Rendered card image and fetched on-chain data successfully.",
      tokenId,
      onchain,
      imageDataUrl: dataUrl,
    });
  } catch (error: any) {
    console.error("❌ Error in /api/generate-card:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error?.message ??
          "Unexpected error while generating the card image.",
      },
      { status: 500 }
    );
  }
}
