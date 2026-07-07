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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Verify that `txHash` is a mined Arc transaction sent FROM `expectedFrom`.
 * This is how a creator proves control of their wallet at registration time:
 * they broadcast a tiny self-transaction from the wallet, and we confirm on-chain
 * that the sender matches the address being registered.
 *
 * The wallet returns a tx hash the instant it broadcasts, but the tx needs a moment
 * to propagate to our RPC node and then to be mined into a block. So we poll: first
 * for the transaction to appear (sender check), then for its receipt (mined + status),
 * up to a bounded timeout. This avoids the "not yet confirmed" 400 that happens when
 * we check a split-second after the user approves in their wallet.
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

  const deadline = Date.now() + 60_000; // wait up to ~60s for mine + propagation

  // 1) Wait for the transaction to be visible on our RPC node, then check sender.
  let tx = null;
  while (Date.now() < deadline) {
    tx = await arcClient
      .getTransaction({ hash: txHash as Hash })
      .catch(() => null);
    if (tx) break;
    await sleep(2_000);
  }
  if (!tx) throw new Error("proofTx not found on Arc testnet");
  if (tx.from.toLowerCase() !== expectedFrom.toLowerCase()) {
    throw new Error("proofTx was not sent from the wallet being registered");
  }

  // 2) Wait for the receipt (i.e. the tx to be mined). viem polls internally and
  //    resolves as soon as the receipt exists, so this returns fast once confirmed.
  let receipt = null;
  try {
    receipt = await arcClient.waitForTransactionReceipt({
      hash: txHash as Hash,
      timeout: Math.max(5_000, deadline - Date.now()),
      pollingInterval: 2_000,
    });
  } catch {
    receipt = null;
  }
  if (!receipt) throw new Error("proofTx is not yet confirmed on Arc testnet");
  if (receipt.status !== "success") throw new Error("proofTx reverted on-chain");
}

