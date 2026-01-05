// scripts/_core-attach-collection.ts
import { publicKey } from "@metaplex-foundation/umi";
import {
  fetchAsset,
  fetchCollection,
  update,
  updateAuthority,
} from "@metaplex-foundation/mpl-core";

/**
 * Attach a Metaplex Core asset to a Core collection.
 *
 * Your mpl-core typings vary by version, so we keep it runtime-correct
 * and only loosen types at the update() boundary (where TS is redlining).
 */
export async function attachCollectionToAsset(args: {
  umi: any;
  asset: string;
  collection: string;
}) {
  const { umi } = args;

  const assetPk = publicKey(args.asset);
  const collectionPk = publicKey(args.collection);

  // Fetch current asset object (some versions want the full Asset object in update())
  const assetObj = await fetchAsset(umi, assetPk);

  // Try to detect an existing collection reference on the asset (shape differs by version)
  const currentCollectionAddr =
    (assetObj as any)?.collection?.address ??
    (assetObj as any)?.collection ??
    (assetObj as any)?.collectionAddress ??
    null;

  // If already in the desired collection, return "already"
  if (
    currentCollectionAddr &&
    String(currentCollectionAddr) === String(collectionPk)
  ) {
    return { signature: null, already: true };
  }

  // If already in SOME collection, some builds require you to pass the existing collection object
  let existingCollectionObj: any | undefined = undefined;
  if (currentCollectionAddr) {
    try {
      existingCollectionObj = await fetchCollection(
        umi,
        publicKey(String(currentCollectionAddr))
      );
    } catch {
      existingCollectionObj = undefined;
    }
  }

  // New collection object we want to attach
  const newCollectionObj = await fetchCollection(umi, collectionPk);

  // Build update args (loosen types here to avoid TS redlines)
  const updateArgs: any = {
    asset: (assetObj as any) ?? (assetPk as any), // some versions accept object, some accept pubkey
    ...(existingCollectionObj ? { collection: existingCollectionObj } : {}),
    newCollection: newCollectionObj,
    newUpdateAuthority: updateAuthority("Collection", [collectionPk]),
  };

  const ix: any = update(umi, updateArgs);
  const res: any = await ix.sendAndConfirm(umi);

  return { signature: res.signature, already: false };
}
