/**
 * Thin typed client for the Assay backend (registry + ledger + metrics) and the
 * agent SSE API. Base URLs come from NEXT_PUBLIC_* so the same build runs locally
 * or against hosted services.
 */
export const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
export const AGENT =
  process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8000";

/* ------------------------------- types ---------------------------------- */

export type Creator = { id: string; name: string; walletAddress: string };

export type SourceCard = {
  id: string;
  creatorId: string;
  title: string;
  abstract: string;
  price: number;
  tags: string[];
  qualityPrior: number;
  contentUrl: string;
  creator: Creator | null;
};

export type Decision = {
  id: string;
  taskId: string;
  sourceId: string;
  creatorId: string;
  decision: "BUY" | "SKIP" | "CACHE";
  rationale: string;
  relevance: number;
  novelty: number;
  expectedGain: number;
  voi: number;
  price: number;
  createdAt?: string;
};

export type Payment = {
  id: string;
  taskId: string;
  sourceId: string;
  creatorId: string;
  amount: number;
  proof: string;
  payer: string;
  network: string;
  createdAt?: string;
};

export type Payout = {
  creatorId: string;
  name: string;
  walletAddress: string;
  totalUsdc: number;
  paidCalls: number;
};

export type Metrics = {
  paidCalls: number;
  totalUsdc: number;
  avgPayment: number;
  uniqueCreatorsPaid: number;
  uniqueTasks: number;
  repeatTasks: number;
  buyCount: number;
  skipCount: number;
  cacheCount: number;
  buySkipRatio: number;
};

/* ------------------------------ helpers ---------------------------------- */

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`);
  }
  return res.json() as Promise<T>;
}

/* -------------------------------- reads ---------------------------------- */

export const getCreators = () =>
  fetch(`${BACKEND}/creators`, { cache: "no-store" }).then(json<Creator[]>);

export const getDiscover = (q = "") =>
  fetch(`${BACKEND}/discover?q=${encodeURIComponent(q)}`, { cache: "no-store" }).then(
    json<SourceCard[]>,
  );

export const getMetrics = () =>
  fetch(`${BACKEND}/metrics`, { cache: "no-store" }).then(json<Metrics>);

export const getPayouts = () =>
  fetch(`${BACKEND}/payouts`, { cache: "no-store" }).then(json<Payout[]>);

export const getDecisions = () =>
  fetch(`${BACKEND}/ledger/decisions`, { cache: "no-store" }).then(json<Decision[]>);

export const getPayments = () =>
  fetch(`${BACKEND}/ledger/payments`, { cache: "no-store" }).then(json<Payment[]>);

/* -------------------------------- writes --------------------------------- */

export const createCreator = (name: string, walletAddress: string) =>
  fetch(`${BACKEND}/creators`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, walletAddress }),
  }).then(json<Creator>);

export const createSource = (input: {
  creatorId: string;
  title: string;
  abstract: string;
  content: string;
  price: number;
  tags: string[];
  qualityPrior?: number;
}) =>
  fetch(`${BACKEND}/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then(json<SourceCard>);

export const fmtUsd = (n: number) =>
  n >= 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(6)}`;
