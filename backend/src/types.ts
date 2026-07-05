/** Core data model for Assay's registry + ledger. */

export interface Creator {
  id: string;
  name: string;
  walletAddress: string;
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

export interface Payment {
  id: string;
  taskId: string;
  sourceId: string;
  creatorId: string;
  /** Amount in USDC dollars actually settled. */
  amount: number;
  /** x402/Gateway settlement proof: tx hash or settlement id. */
  proof: string;
  payer: string;
  network: string;
  createdAt: string;
}

export interface Task {
  id: string;
  prompt: string;
  budget: number;
  createdAt: string;
}
