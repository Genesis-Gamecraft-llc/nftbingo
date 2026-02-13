import "server-only";
import { Connection, PublicKey, type PublicKey as PublicKeyType } from "@solana/web3.js";

export type VerifySolTxInput = {
  rpcUrl: string;
  signature: string;
  expectedFrom: string;
  expectedTo: string;
  minLamports: number;
};

function getAccountKeyStrings(tx: any): string[] {
  const msg: any = tx?.transaction?.message;
  if (!msg) throw new Error("Invalid transaction message.");

  // Newer web3.js (v0 / versioned): use getAccountKeys()
  if (typeof msg.getAccountKeys === "function") {
    const keysObj: any = msg.getAccountKeys();
    const staticKeys: PublicKeyType[] = Array.isArray(keysObj?.staticAccountKeys)
      ? keysObj.staticAccountKeys
      : Array.isArray(keysObj?.accountKeys)
        ? keysObj.accountKeys
        : [];

    if (!staticKeys.length) throw new Error("No account keys found in transaction message.");
    return staticKeys.map((k) => k.toBase58());
  }

  // Legacy: message.accountKeys exists
  if (Array.isArray(msg.accountKeys)) {
    return msg.accountKeys.map((k: PublicKeyType | string) => (typeof k === "string" ? k : k.toBase58()));
  }

  throw new Error("Cannot read account keys from transaction message.");
}

export async function verifySolTransferTx(input: VerifySolTxInput) {
  const { rpcUrl, signature, expectedFrom, expectedTo, minLamports } = input;

  const connection = new Connection(rpcUrl, "confirmed");

  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) throw new Error("Transaction not found yet.");
  if (tx.meta?.err) throw new Error("Transaction failed on-chain.");
  if (!tx.transaction) throw new Error("Invalid transaction data.");

  const fromPk = new PublicKey(expectedFrom).toBase58();
  const toPk = new PublicKey(expectedTo).toBase58();

  const accountKeys = getAccountKeyStrings(tx);

  // Find SOL transfer by comparing balance diffs (robust across compiled instructions)
  const pre = tx.meta?.preBalances || [];
  const post = tx.meta?.postBalances || [];

  if (pre.length !== post.length || pre.length !== accountKeys.length) {
    throw new Error("Unexpected transaction format.");
  }

  const fromIdx = accountKeys.indexOf(fromPk);
  const toIdx = accountKeys.indexOf(toPk);

  if (fromIdx === -1) throw new Error("Sender wallet not found in transaction.");
  if (toIdx === -1) throw new Error("Pot wallet not found in transaction.");

  const fromDelta = post[fromIdx] - pre[fromIdx]; // negative if spent
  const toDelta = post[toIdx] - pre[toIdx]; // positive if received

  if (toDelta < minLamports) {
    throw new Error("Pot wallet did not receive expected SOL amount.");
  }

  // Sender must be the one funding the transfer (fee payer effects allowed; still must decrease)
  if (fromDelta >= 0) {
    throw new Error("Sender wallet did not pay SOL for this transfer.");
  }

  return {
    ok: true as const,
    toReceivedLamports: toDelta,
  };
}
