import type { Hash } from "viem";

export interface ReceiptAnchorRpc {
  getChainId(): Promise<number>;
  getTransaction(args: { hash: Hash }): Promise<{
    from: string;
    to: string | null;
    input: string;
    value: bigint;
    chainId?: number | null;
  }>;
  waitForTransactionReceipt(args: {
    hash: Hash;
    timeout: number;
    pollingInterval: number;
  }): Promise<{ status: "success" | "reverted"; blockNumber: bigint }>;
}

export interface VerifiedReceiptAnchor {
  txHash: Hash;
  blockNumber: string;
  chainId: 5042;
}

const sameAddress = (left: string | null, right: string) =>
  !!left && left.toLowerCase() === right.toLowerCase();

export async function verifyReceiptAnchor(input: {
  client: ReceiptAnchorRpc;
  txHash: string;
  signer: string;
  anchorTarget: string;
  expectedCalldata: string;
}): Promise<VerifiedReceiptAnchor> {
  if (!/^0x[a-fA-F0-9]{64}$/.test(input.txHash)) {
    throw new Error("anchor tx hash must be a 32-byte hex value");
  }

  const chainId = await input.client.getChainId();
  if (chainId !== 5042) throw new Error(`Arc mainnet RPC returned wrong chain ID: ${chainId}`);

  let transaction;
  try {
    transaction = await input.client.getTransaction({ hash: input.txHash as Hash });
  } catch {
    throw new Error("anchor transaction was not found on Arc mainnet");
  }

  if (transaction.chainId != null && transaction.chainId !== 5042) {
    throw new Error("anchor transaction has the wrong chain ID");
  }
  if (!sameAddress(transaction.from, input.signer)) {
    throw new Error("anchor transaction sender does not match authorization signer");
  }
  if (!sameAddress(transaction.to, input.anchorTarget)) {
    throw new Error("anchor transaction target is not the Arc Memo contract");
  }
  if (transaction.value !== 0n) throw new Error("anchor transaction value must be zero");
  if (transaction.input.toLowerCase() !== input.expectedCalldata.toLowerCase()) {
    throw new Error("anchor transaction calldata does not match the receipt hash");
  }

  let receipt;
  try {
    receipt = await input.client.waitForTransactionReceipt({
      hash: input.txHash as Hash,
      timeout: 60_000,
      pollingInterval: 2_000,
    });
  } catch {
    throw new Error("anchor transaction is not mined yet");
  }
  if (receipt.status !== "success") throw new Error("anchor transaction reverted");

  return { txHash: input.txHash as Hash, blockNumber: receipt.blockNumber.toString(), chainId: 5042 };
}
