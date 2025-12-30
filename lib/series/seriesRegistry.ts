// lib/series/seriesRegistry.ts
export type SelectionMode = "random" | "explicit";

export type VariantConfig = {
  id: string; // e.g. "bg0", "vip-gold-dragon"
  backgroundPath: string; // must be under public/backgrounds/...
  maxSupply: number; // 1 for 1/1, or capped number
  weight?: number; // optional weighting for random selection
};

export type SeriesConfig = {
  seriesId: string;              // "founders" | "series1" | "creator"
  displayName: string;           // for UI
  editionLabel: string;          // metadata "Edition" trait
  payoutTier: string;            // what your game uses later
  selectionMode: SelectionMode;  // "random" for public mints, "explicit" for admin/VIP
  variants: VariantConfig[];     // background pool + supply
};

export const SERIES_REGISTRY: Record<string, SeriesConfig> = {
  founders: {
    seriesId: "founders",
    displayName: "Founders Series",
    editionLabel: "Founders Series",
    payoutTier: "founders",
    selectionMode: "random",
    variants: [
      // Adjust maxSupply/weights as you want
      { id: "bg0", backgroundPath: "backgrounds/series1/bg0.png", maxSupply: 9999 },
      { id: "bg1", backgroundPath: "backgrounds/series1/bg1.png", maxSupply: 9999 },
      { id: "bg2", backgroundPath: "backgrounds/series1/bg2.png", maxSupply: 9999 },
      { id: "bg8", backgroundPath: "backgrounds/series1/bg8.png", maxSupply: 9999 },
    ],
  },

  series1: {
    seriesId: "series1",
    displayName: "NFTBingo Series 1",
    editionLabel: "Series 1",
    payoutTier: "series1",
    selectionMode: "random",
    variants: [
      { id: "bg0", backgroundPath: "backgrounds/series1/bg0.png", maxSupply: 9999 },
      { id: "bg1", backgroundPath: "backgrounds/series1/bg1.png", maxSupply: 9999 },
      { id: "bg2", backgroundPath: "backgrounds/series1/bg2.png", maxSupply: 9999 },
    ],
  },

  // Creator is a TEMPLATE conceptually — we’ll map projectId -> a generated SeriesConfig
  // in the mint route (creator + projectId). That keeps the registry from exploding.
  creator: {
    seriesId: "creator",
    displayName: "Creator Launchpad",
    editionLabel: "Creator Launchpad",
    payoutTier: "creator",
    selectionMode: "random",
    variants: [], // filled per projectId
  },
};

export function getSeriesConfig(seriesId: string): SeriesConfig {
  const cfg = SERIES_REGISTRY[seriesId];
  if (!cfg) throw new Error(`Unknown seriesId: ${seriesId}`);
  return cfg;
}

