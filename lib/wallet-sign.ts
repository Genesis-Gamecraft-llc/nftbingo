import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";

export function verifyWalletSignature(opts: {
  wallet: string;
  message: string;
  signatureBase58: string;
}) {
  const pubkey = new PublicKey(opts.wallet);
  const sig = bs58.decode(opts.signatureBase58);
  const msg = new TextEncoder().encode(opts.message);

  return nacl.sign.detached.verify(msg, sig, pubkey.toBytes());
}