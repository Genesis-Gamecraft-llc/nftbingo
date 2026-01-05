import "dotenv/config";

import * as mplCore from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import { getUmiVipMainnet } from "./umi.vip";

// ---------- CLI helpers ----------
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const assetArg = arg("asset");
if (!assetArg) {
  console.log(`
Usage:
  npx tsx scripts/get-collection-from-asset.ts --asset <ASSET_ADDRESS>

Example:
  npx tsx scripts/get-collection-from-asset.ts --asset 4MvuW44TtDFKoYwntQhEkoqXz6Z4DHMxBodBaCWGQKAy
`);
  process.exit(1);
  // TS sometimes doesn't narrow after process.exit() depending on settings
  throw new Error("Missing --asset argument");
}

// ✅ assetStr is now a guaranteed string
const assetStr: string = assetArg;

// mpl-core has had different export names across versions
const fetchAssetFn: any =
  (mplCore as any).fetchAsset ??
  (mplCore as any).fetchAssetV1 ??
  (mplCore as any).fetchAssetV2;

async function main() {
  const umi = getUmiVipMainnet();

  if (!fetchAssetFn) {
    throw new Error(
      "Could not find fetchAsset export from @metaplex-foundation/mpl-core. Your mpl-core version may be incompatible."
    );
  }

  const asset = await fetchAssetFn(umi, publicKey(assetStr));

  // Core collection info is stored in plugins (shape varies by version)
  const plugins: any[] = (asset as any).plugins ?? (asset as any).pluginData ?? [];

  const collectionPlugin =
    plugins.find((p) => p?.type === "Collection") ||
    plugins.find((p) => p?.pluginType === "Collection") ||
    plugins.find((p) =>
      String(p?.type ?? p?.pluginType ?? "").toLowerCase().includes("collection")
    );

  if (!collectionPlugin) {
    console.log("\n❌ No collection plugin found on this asset.");
    console.log("Asset:", assetStr);
    console.log("Plugins seen:", plugins);
    return;
  }

  // Try several known shapes
  const collectionAddress =
    collectionPlugin?.data?.collection ??
    collectionPlugin?.collection ??
    collectionPlugin?.data?.address ??
    collectionPlugin?.address ??
    collectionPlugin?.data?.value ??
    collectionPlugin?.value;

  console.log("\n✅ Collection info found");
  console.log("Asset:", assetStr);
  console.log("Collection Address:", collectionAddress?.toString?.() ?? collectionAddress);
  console.log("Collection Plugin (raw):", collectionPlugin);
}

main().catch((e) => {
  console.error("\n❌ Failed:", e?.message ?? e);
  process.exit(1);
});
