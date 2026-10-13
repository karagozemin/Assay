/** Core data model for Assay's registry + ledger. */

export interface Creator {
  id: string;
  name: string;
  walletAddress: string;
  /** Arc testnet tx hash proving control of walletAddress at registration time. */
  proofTx: string;
  createdAt: string;
}


export interface Source {
  id: string;
  creatorId: string;
  title: string;
  abstract: string;
  /** Full paid content — never returned by /discover, only by the x402-protected /content route. */
  content: string;
  /** Per-use price in USDC dollars, e.g. 0.001 */
  price: number;
  tags: string[];
  /** Prior on source usefulness [0..1], set by creator/curator; feeds ASSAY expected_gain. */
  qualityPrior: number;
  /** Precomputed embedding of the abstract (used by the agent's ASSAY node). */
  embedding: number[];
  createdAt: string;
}

/** What /discover returns — metadata only, NEVER the content field. */
export type SourceCard = Omit<Source, "content">;

export type DecisionKind = "BUY" | "SKIP" | "CACHE";

export interface Decision {
  id: string;
  taskId: string;
  sourceId: string;
  creatorId: string;
  decision: DecisionKind;
  /** Machine + human readable rationale — REQUIRED for every decision, especially refusals. */
  rationale: string;
  relevance: number;
  novelty: number;
  expectedGain: number;
  voi: number;
  price: number;
  createdAt: string;
}

export type PaymentProvenance =
  | "demo_test_settlement"
  | "arc_testnet_x402"
  | "payment_intent"
  | "arc_mainnet_receipt_anchor";

export interface Payment {
  id: string;
  taskId: string;
  sourceId: string;
  creatorId: string;
  /** Amount requested by this payment-stage event. */
  amount: number;
  /** Payment-stage identifier; provenance determines whether it is a settlement proof. */
  proof: string;
  payer: string;
  network: string;
  provenance: PaymentProvenance;
  createdAt: string;
}

export interface Task {
  id: string;
  prompt: string;
  budget: number;
  createdAt: string;
}

export type ReceiptAnchorStatus = "pending" | "verified";

export interface RunReceiptRecord {
  id: string;
  taskId: string;
  authorizationId: string;
  receiptHash: string;
  canonicalJson: string;
  signer: string;
  /** Exact calldata for the Arc Memo contract anchor transaction. */
  expectedCalldata: string;
  chainId: number;
  completionTimestamp: string;
  createdAt: string;
  anchorStatus: ReceiptAnchorStatus;
  txHash: string | null;
  blockNumber: string | null;
  explorerUrl: string | null;
  verifiedAt: string | null;
}
