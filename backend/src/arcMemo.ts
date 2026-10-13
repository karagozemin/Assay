import { encodeFunctionData, isAddress } from "viem";
import { receiptCalldata } from "./receipt.ts";

/** Arc's predeployed Memo and USDC contracts (same addresses on mainnet and testnet). */
export const ARC_MEMO_CONTRACT = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505" as const;
export const ARC_USDC_CONTRACT = "0x3600000000000000000000000000000000000000" as const;

export const ARC_MEMO_ABI = [
  {
    type: "function",
    name: "memo",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
      { name: "memoId", type: "bytes32" },
      { name: "memoData", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const BALANCE_OF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

/**
 * Build the exact Arc Memo transaction that the browser signs.
 *
 * The child call is a read-only USDC balanceOf(signer), so the proof neither transfers
 * funds nor mutates an allowance. The Memo predeploy records the receipt hash on-chain.
 */
export function buildReceiptAnchorPlan(receiptHash: string, signer: string) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(receiptHash)) {
    throw new Error("receipt hash must be a 32-byte hex value");
  }
  if (!isAddress(signer)) throw new Error("receipt signer must be an EVM address");

  const targetCalldata = encodeFunctionData({
    abi: BALANCE_OF_ABI,
    functionName: "balanceOf",
    args: [signer],
  });
  const memoData = receiptCalldata(receiptHash);
  const expectedCalldata = encodeFunctionData({
    abi: ARC_MEMO_ABI,
    functionName: "memo",
    args: [ARC_USDC_CONTRACT, targetCalldata, receiptHash as `0x${string}`, memoData],
  });

  return {
    anchorTarget: ARC_MEMO_CONTRACT,
    innerTarget: ARC_USDC_CONTRACT,
    targetCalldata,
    memoId: receiptHash as `0x${string}`,
    memoData,
    expectedCalldata,
  };
}
