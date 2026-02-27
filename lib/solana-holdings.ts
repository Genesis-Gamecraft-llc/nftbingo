type DasAsset = {
  grouping?: Array<{ group_key: string; group_value: string }>;
};

type DasResponse = {
  result?: {
    items?: DasAsset[];
    total?: number;
  };
  error?: { message?: string };
};

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

/**
 * FIX: Don't hard-require ALCHEMY_SOLANA_RPC_URL.
 * Fall back to your already-established NEXT_PUBLIC_SOLANA_RPC_URL.
 */
const RPC = () =>
  process.env.ALCHEMY_SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  must("ALCHEMY_SOLANA_RPC_URL");

export type Holdings = {
  players: boolean;
  vip: boolean;
  founders: boolean;
};

function collectionMints() {
  return {
    players: must("NEXT_PUBLIC_PLAYER_SERIES_COLLECTION_MINT"),
    vip: must("NEXT_PUBLIC_VIP_COLLECTION_MINT"),
    founders: must("NEXT_PUBLIC_FOUNDERS_COLLECTION_MINT"),
  };
}

export async function getHoldingsByOwner(owner: string): Promise<Holdings> {
  const { players, vip, founders } = collectionMints();

  const want = new Set([players, vip, founders]);
  const found = new Set<string>();

  // Page through a bit; most wallets won't have tons of NFTs
  let page = 1;
  const limit = 100;

  while (page <= 10 && found.size < want.size) {
    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "getAssetsByOwner",
      /**
       * FIX: DAS getAssetsByOwner expects params as an OBJECT, not an array.
       * Using an array here can trigger "invalid type: map, expected a string..."
       * depending on the provider/implementation.
       */
      params: {
        ownerAddress: String(owner),
        page,
        limit,
      },
    };

    const res = await fetch(RPC(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => ({}))) as DasResponse;

    if (!res.ok || json.error) {
      const msg = json.error?.message || `RPC error (HTTP ${res.status})`;
      throw new Error(`Solana RPC getAssetsByOwner failed: ${msg}`);
    }

    const items = json.result?.items || [];
    if (!items.length) break;

    for (const it of items) {
      const groups = it.grouping || [];
      for (const g of groups) {
        if (g.group_key === "collection" && want.has(g.group_value)) {
          found.add(g.group_value);
        }
      }
    }

    page += 1;
  }

  return {
    players: found.has(players),
    vip: found.has(vip),
    founders: found.has(founders),
  };
}