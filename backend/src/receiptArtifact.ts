import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { RunReceiptRecord } from "./types.ts";
import { ARC_MEMO_CONTRACT, ARC_USDC_CONTRACT } from "./arcMemo.ts";

export interface MainnetReceiptAnchorArtifact {
  artifactVersion: "assay.mainnet-receipt-anchor.v1";
  receiptId: string;
  receiptHash: string;
  txHash: string;
  blockNumber: string;
  signer: string;
  chainId: number;
  explorerUrl: string;
  completionTimestamp: string;
  verifiedAt: string;
  expectedCalldata: string;
  anchorTarget: string;
  innerTarget: string;
  hashInput: {
    encoding: "utf-8";
    canonicalJson: string;
  };
  canonicalReceipt: unknown;
  proofScope: "run_receipt_and_decision_ledger_not_creator_payment_settlement";
}

export function buildReceiptArtifact(receipt: RunReceiptRecord): MainnetReceiptAnchorArtifact {
  if (
    receipt.anchorStatus !== "verified" ||
    !receipt.txHash ||
    !receipt.blockNumber ||
    !receipt.explorerUrl ||
    !receipt.verifiedAt
  ) {
    throw new Error("cannot build an artifact for an unverified receipt");
  }
  return {
    artifactVersion: "assay.mainnet-receipt-anchor.v1",
    receiptId: receipt.id,
    receiptHash: receipt.receiptHash,
    txHash: receipt.txHash,
    blockNumber: receipt.blockNumber,
    signer: receipt.signer,
    chainId: receipt.chainId,
    explorerUrl: receipt.explorerUrl,
    completionTimestamp: receipt.completionTimestamp,
    verifiedAt: receipt.verifiedAt,
    expectedCalldata: receipt.expectedCalldata,
    anchorTarget: ARC_MEMO_CONTRACT,
    innerTarget: ARC_USDC_CONTRACT,
    hashInput: { encoding: "utf-8", canonicalJson: receipt.canonicalJson },
    canonicalReceipt: JSON.parse(receipt.canonicalJson),
    proofScope: "run_receipt_and_decision_ledger_not_creator_payment_settlement",
  };
}

/** Write both a receipt-specific artifact and the requested stable latest-artifact name. */
export function writeReceiptArtifact(receipt: RunReceiptRecord, dbPath: string): string {
  const directory = join(dirname(dbPath), "artifacts");
  mkdirSync(directory, { recursive: true });
  const json = `${JSON.stringify(buildReceiptArtifact(receipt), null, 2)}\n`;
  const receiptPath = join(directory, `mainnet-receipt-anchor-${receipt.id}.json`);
  const temporaryPath = `${receiptPath}.tmp`;
  writeFileSync(temporaryPath, json, { encoding: "utf8", mode: 0o600 });
  renameSync(temporaryPath, receiptPath);
  const latestPath = join(directory, "mainnet-receipt-anchor.json");
  const latestTemporaryPath = `${latestPath}.tmp`;
  writeFileSync(latestTemporaryPath, json, { encoding: "utf8", mode: 0o600 });
  renameSync(latestTemporaryPath, latestPath);
  return receiptPath;
}
