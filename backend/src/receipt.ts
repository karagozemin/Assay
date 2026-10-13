import { keccak256, toBytes } from "viem";
import type { Decision, Payment, Task } from "./types.ts";
import type { MandateSummary } from "./mandate.ts";

export const RECEIPT_FORMAT_VERSION = "assay.run-receipt.v1" as const;
export const RECEIPT_CALLDATA_PREFIX = "ASSAY_V1" as const;
const RECEIPT_CALLDATA_PREFIX_HEX = Buffer.from(RECEIPT_CALLDATA_PREFIX, "ascii").toString("hex");

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface CanonicalRunReceipt {
  formatVersion: typeof RECEIPT_FORMAT_VERSION;
  taskId: string;
  promptHash: `0x${string}`;
  taskBudgetUsdc: string;
  authorization: {
    mandateId: string;
    signer: string;
    signedCapUnits: string;
    spentUnitsAtReceipt: string;
    nonce: string;
    expiry: number;
  };
  decisionHashes: `0x${string}`[];
  paymentItems: Array<{
    paymentId: string;
    sourceId: string;
    creatorId: string;
    amountUsdc: string;
    payer: string;
    network: string;
    proofOrIntentId: string;
    settlementMode: Payment["provenance"];
    recordedAt: string;
  }>;
  completionTimestamp: string;
  backendReceiptCreatedAt: string;
}

function normalizeJson(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("canonical JSON cannot contain non-finite numbers");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, JsonValue> = {};
    for (const key of Object.keys(record).sort()) {
      if (record[key] === undefined) continue;
      normalized[key] = normalizeJson(record[key]);
    }
    return normalized;
  }
  throw new Error(`unsupported canonical JSON value: ${typeof value}`);
}

/** Deterministic recursive key ordering for the JSON shapes used by Assay receipts. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

export function hashCanonicalValue(value: unknown): `0x${string}` {
  return keccak256(toBytes(canonicalJson(value)));
}

const decimal = (value: number): string => {
  if (!Number.isFinite(value)) throw new Error("receipt numeric value must be finite");
  return value.toString();
};

function decisionHash(decision: Decision): `0x${string}` {
  return hashCanonicalValue({
    decisionId: decision.id,
    sourceId: decision.sourceId,
    creatorId: decision.creatorId,
    decision: decision.decision,
    rationale: decision.rationale,
    relevance: decimal(decision.relevance),
    novelty: decimal(decision.novelty),
    expectedGain: decimal(decision.expectedGain),
    voi: decimal(decision.voi),
    priceUsdc: decimal(decision.price),
    recordedAt: decision.createdAt,
  });
}

function ledgerCompletionTimestamp(task: Task, decisions: Decision[], payments: Payment[]): string {
  const timestamps = [
    task.createdAt,
    ...decisions.map((decision) => decision.createdAt),
    ...payments.map((payment) => payment.createdAt),
  ];
  return timestamps.sort().at(-1) ?? task.createdAt;
}

export function buildCanonicalRunReceipt(input: {
  task: Task;
  mandate: MandateSummary;
  decisions: Decision[];
  payments: Payment[];
  backendReceiptCreatedAt: string;
}): CanonicalRunReceipt {
  if (input.decisions.length === 0) {
    throw new Error("run receipt requires at least one persisted decision");
  }

  return {
    formatVersion: RECEIPT_FORMAT_VERSION,
    taskId: input.task.id,
    promptHash: keccak256(toBytes(input.task.prompt)),
    taskBudgetUsdc: decimal(input.task.budget),
    authorization: {
      mandateId: input.mandate.id,
      signer: input.mandate.signer.toLowerCase(),
      signedCapUnits: input.mandate.capUnits,
      spentUnitsAtReceipt: input.mandate.spentUnits,
      nonce: input.mandate.nonce,
      expiry: input.mandate.expiry,
    },
    decisionHashes: input.decisions.map(decisionHash),
    paymentItems: input.payments.map((payment) => ({
      paymentId: payment.id,
      sourceId: payment.sourceId,
      creatorId: payment.creatorId,
      amountUsdc: decimal(payment.amount),
      payer: payment.payer.toLowerCase(),
      network: payment.network,
      proofOrIntentId: payment.proof,
      settlementMode: payment.provenance,
      recordedAt: payment.createdAt,
    })),
    completionTimestamp: ledgerCompletionTimestamp(input.task, input.decisions, input.payments),
    backendReceiptCreatedAt: input.backendReceiptCreatedAt,
  };
}

export function receiptHash(receipt: CanonicalRunReceipt): `0x${string}` {
  return hashCanonicalValue(receipt);
}

export function receiptCalldata(hash: string): `0x${string}` {
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error("receipt hash must be a 32-byte hex value");
  }
  return `0x${RECEIPT_CALLDATA_PREFIX_HEX}${hash.slice(2).toLowerCase()}`;
}
