import type { RunReceiptRecord } from "./types.ts";

export function runReceiptView(receipt: RunReceiptRecord, explorerBaseUrl: string) {
  return {
    receiptId: receipt.id,
    taskId: receipt.taskId,
    receiptHash: receipt.receiptHash,
    canonicalReceipt: JSON.parse(receipt.canonicalJson),
    canonicalJson: receipt.canonicalJson,
    expectedCalldata: receipt.expectedCalldata,
    signer: receipt.signer,
    chainId: receipt.chainId,
    explorerBaseUrl,
    anchorStatus: receipt.anchorStatus,
    verificationStatus: receipt.anchorStatus === "verified" ? "verified" : "pending",
    txHash: receipt.txHash,
    blockNumber: receipt.blockNumber,
    explorerUrl: receipt.explorerUrl,
    completionTimestamp: receipt.completionTimestamp,
    receiptCreatedAt: receipt.createdAt,
    verifiedAt: receipt.verifiedAt,
    artifactUrl:
      receipt.anchorStatus === "verified" ? `/receipts/${receipt.id}/artifact` : null,
    proofScope: "Arc mainnet run receipt anchor — not creator payment settlement",
  };
}
