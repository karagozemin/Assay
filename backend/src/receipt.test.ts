import assert from "node:assert/strict";
import test from "node:test";
import { decodeFunctionData } from "viem";
import type { Decision, Payment, RunReceiptRecord, Task } from "./types.ts";
import {
  buildCanonicalRunReceipt,
  canonicalJson,
  receiptCalldata,
  receiptHash,
} from "./receipt.ts";
import { buildReceiptArtifact } from "./receiptArtifact.ts";
import { runReceiptView } from "./receiptView.ts";
import {
  ARC_MEMO_ABI,
  ARC_MEMO_CONTRACT,
  ARC_USDC_CONTRACT,
  buildReceiptAnchorPlan,
} from "./arcMemo.ts";

const task: Task = {
  id: "task-1",
  prompt: "Which source is worth buying?",
  budget: 0.02,
  createdAt: "2026-10-13T10:00:00.000Z",
};
const decision: Decision = {
  id: "decision-1",
  taskId: task.id,
  sourceId: "source-1",
  creatorId: "creator-1",
  decision: "BUY",
  rationale: "highest marginal value",
  relevance: 0.9,
  novelty: 0.8,
  expectedGain: 0.72,
  voi: 360,
  price: 0.002,
  createdAt: "2026-10-13T10:00:01.000Z",
};
const payment: Payment = {
  id: "payment-1",
  taskId: task.id,
  sourceId: "source-1",
  creatorId: "creator-1",
  amount: 0.002,
  proof: "payment-intent-1",
  payer: "",
  network: "eip155:5042002",
  provenance: "payment_intent",
  createdAt: "2026-10-13T10:00:02.000Z",
};
const mandate = {
  id: "mandate-1",
  signer: "0x1111111111111111111111111111111111111111" as const,
  capUnits: "20000",
  spentUnits: "0",
  nonce: "nonce-1",
  expiry: 1791889200,
  createdAt: 1791885600,
};

const makeReceipt = () =>
  buildCanonicalRunReceipt({
    task,
    mandate,
    decisions: [decision],
    payments: [payment],
    backendReceiptCreatedAt: "2026-10-13T10:00:03.000Z",
  });

test("canonical JSON sorts object keys and preserves array order", () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, b: 3 }, list: [3, 2, 1] }),
    '{"a":{"b":3,"y":2},"list":[3,2,1],"z":1}');
});

test("receipt hash is stable for identical ledger input", () => {
  assert.equal(receiptHash(makeReceipt()), receiptHash(makeReceipt()));
  assert.equal(makeReceipt().paymentItems[0].settlementMode, "payment_intent");
});

test("expected calldata is ASCII ASSAY_V1 followed by exact receipt hash", () => {
  const hash = receiptHash(makeReceipt());
  const calldata = receiptCalldata(hash);
  const prefix = Buffer.from("ASSAY_V1", "ascii").toString("hex");
  assert.equal(calldata, `0x${prefix}${hash.slice(2)}`);
  assert.equal((calldata.length - 2) / 2, 40);
});

test("Arc mainnet anchor plan targets Memo and commits to the exact receipt hash", () => {
  const hash = receiptHash(makeReceipt());
  const plan = buildReceiptAnchorPlan(hash, mandate.signer);
  assert.equal(plan.anchorTarget, ARC_MEMO_CONTRACT);
  assert.equal(plan.innerTarget, ARC_USDC_CONTRACT);
  assert.equal(plan.memoId, hash);
  assert.equal(plan.memoData, receiptCalldata(hash));
  assert.match(plan.expectedCalldata, /^0x[a-fA-F0-9]+$/);
  assert.ok(plan.expectedCalldata.length > plan.memoData.length);
  const decoded = decodeFunctionData({ abi: ARC_MEMO_ABI, data: plan.expectedCalldata });
  assert.equal(decoded.functionName, "memo");
  assert.deepEqual(decoded.args, [
    ARC_USDC_CONTRACT,
    plan.targetCalldata,
    hash,
    plan.memoData,
  ]);
});

const verifiedRecord = (): RunReceiptRecord => {
  const canonical = makeReceipt();
  const hash = receiptHash(canonical);
  const anchorPlan = buildReceiptAnchorPlan(hash, mandate.signer);
  return {
    id: "receipt-1",
    taskId: task.id,
    authorizationId: mandate.id,
    receiptHash: hash,
    canonicalJson: canonicalJson(canonical),
    signer: mandate.signer,
    expectedCalldata: anchorPlan.expectedCalldata,
    chainId: 5042,
    completionTimestamp: canonical.completionTimestamp,
    createdAt: canonical.backendReceiptCreatedAt,
    anchorStatus: "verified",
    txHash: `0x${"ab".repeat(32)}`,
    blockNumber: "123",
    explorerUrl: `https://explorer.arc.io/tx/0x${"ab".repeat(32)}`,
    verifiedAt: "2026-10-13T10:01:00.000Z",
  };
};

test("mainnet proof artifact contains the required schema and honest scope", () => {
  const artifact = buildReceiptArtifact(verifiedRecord());
  assert.equal(artifact.chainId, 5042);
  assert.equal(artifact.receiptHash, verifiedRecord().receiptHash);
  assert.equal(artifact.anchorTarget, ARC_MEMO_CONTRACT);
  assert.equal(
    artifact.proofScope,
    "run_receipt_and_decision_ledger_not_creator_payment_settlement",
  );
  assert.equal(artifact.hashInput.canonicalJson, verifiedRecord().canonicalJson);
});

test("GET receipt view exposes verified anchor status and explorer artifact links", () => {
  const view = runReceiptView(verifiedRecord(), "https://explorer.arc.io");
  assert.equal(view.anchorStatus, "verified");
  assert.equal(view.verificationStatus, "verified");
  assert.equal(view.blockNumber, "123");
  assert.equal(view.artifactUrl, "/receipts/receipt-1/artifact");
  assert.match(view.proofScope, /not creator payment settlement/);
});
