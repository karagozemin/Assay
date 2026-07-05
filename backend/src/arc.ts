/**
 * Shared Arc Testnet constants (verified end-to-end in payments-poc).
 * Arc testnet USDC has 6 decimals; the CAIP-2 network id is used by the x402 batching SDK.
 */
export const ARC = {
  NETWORK: "eip155:5042002",
  CHAIN_ID: 5042002,
  RPC_URL: "https://rpc.testnet.arc.network",
  USDC: "0x3600000000000000000000000000000000000000" as `0x${string}`,
  GATEWAY_WALLET: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as `0x${string}`,
  FACILITATOR_URL: "https://gateway-api-testnet.circle.com",
  EXPLORER: "https://testnet.arcscan.app",
} as const;

/** Build a facilitator link to verify a settlement/transfer by id. */
export function transferUrl(settlementId: string): string {
  return `${ARC.FACILITATOR_URL}/v1/x402/transfers/${settlementId}`;
}

import { createPublicClient, http, type Hash } from "viem";

const arcClient = createPublicClient({ transport: http(ARC.RPC_URL) });

/**
 * Verify that `txHash` is a mined Arc transaction sent FROM `expectedFrom`.
 * This is how a creator proves control of their wallet at registration time:
 * they broadcast a tiny self-transaction from the wallet, and we confirm on-chain
 * that the sender matches the address being registered.
 *
 * Throws with a human-readable message on any mismatch so the API can 400.
 */
export async function verifyRegistrationTx(
  txHash: string,
  expectedFrom: string,
): Promise<void> {
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error("proofTx must be a 0x transaction hash");
  }
  let tx;
  try {
    tx = await arcClient.getTransaction({ hash: txHash as Hash });
  } catch {
    throw new Error("proofTx not found on Arc testnet");
  }
  if (!tx) throw new Error("proofTx not found on Arc testnet");
  if (tx.from.toLowerCase() !== expectedFrom.toLowerCase()) {
    throw new Error("proofTx was not sent from the wallet being registered");
  }
  const receipt = await arcClient
    .getTransactionReceipt({ hash: txHash as Hash })
    .catch(() => null);
  if (!receipt) throw new Error("proofTx is not yet confirmed on Arc testnet");
  if (receipt.status !== "success") throw new Error("proofTx reverted on-chain");
}

