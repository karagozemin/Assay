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

export type Creator = {
  id: string;
  name: string;
  walletAddress: string;
  proofTx?: string;
};


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

// Backend uses different field names (totalUsdcSettled, totalPaidCalls, …);
// normalize them to the shape the UI expects so nothing renders as 0/undefined.
type RawMetrics = {
  totalPaidCalls?: number;
  paidCalls?: number;
  totalUsdcSettled?: number;
  totalUsdc?: number;
  avgPaymentSize?: number;
  avgPayment?: number;
  uniqueCreatorsPaid?: number;
  uniqueTasksRun?: number;
  uniqueTasks?: number;
  repeatTaskCount?: number;
  repeatTasks?: number;
  buyCount?: number;
  skipCount?: number;
  cacheCount?: number;
  buySkipRatio?: number;
};

export const getMetrics = () =>
  fetch(`${BACKEND}/metrics`, { cache: "no-store" })
    .then(json<RawMetrics>)
    .then(
      (m): Metrics => ({
        paidCalls: m.totalPaidCalls ?? m.paidCalls ?? 0,
        totalUsdc: m.totalUsdcSettled ?? m.totalUsdc ?? 0,
        avgPayment: m.avgPaymentSize ?? m.avgPayment ?? 0,
        uniqueCreatorsPaid: m.uniqueCreatorsPaid ?? 0,
        uniqueTasks: m.uniqueTasksRun ?? m.uniqueTasks ?? 0,
        repeatTasks: m.repeatTaskCount ?? m.repeatTasks ?? 0,
        buyCount: m.buyCount ?? 0,
        skipCount: m.skipCount ?? 0,
        cacheCount: m.cacheCount ?? 0,
        buySkipRatio: m.buySkipRatio ?? 0,
      }),
    );

type RawPayout = Omit<Payout, "totalUsdc"> & {
  totalUsdc?: number;
  totalEarned?: number;
};

export const getPayouts = () =>
  fetch(`${BACKEND}/payouts`, { cache: "no-store" })
    .then(json<RawPayout[]>)
    .then((list) =>
      list.map(
        (p): Payout => ({
          creatorId: p.creatorId,
          name: p.name,
          walletAddress: p.walletAddress,
          paidCalls: p.paidCalls,
          totalUsdc: p.totalUsdc ?? p.totalEarned ?? 0,
        }),
      ),
    );


export const getDecisions = () =>
  fetch(`${BACKEND}/ledger/decisions`, { cache: "no-store" }).then(json<Decision[]>);

export const getPayments = () =>
  fetch(`${BACKEND}/ledger/payments`, { cache: "no-store" }).then(json<Payment[]>);

/* -------------------------------- writes --------------------------------- */

export const createCreator = (
  name: string,
  walletAddress: string,
  proofTx: string,
) =>
  fetch(`${BACKEND}/creators`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, walletAddress, proofTx }),
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

/**
 * Register a browser-signed spending mandate with the backend. The backend verifies
 * the EIP-712 signature server-side and returns a mandate id that every /pay/settle
 * for this run must carry. The signed cap is enforced backend-side, so it can't be
 * bypassed from the UI.
 */
export type RegisteredAuthorization = {
  id: string;
  user: string;
  capUsdc: number;
  expiry: number;
};

export const registerAuthorization = (auth: {
  user: string;
  token: string;
  cap: string; // USDC base units, decimal string
  nonce: string;
  expiry: number;
  signature: string;
}) =>
  fetch(`${BACKEND}/authorizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(auth),
  }).then(json<RegisteredAuthorization>);

export const fmtUsd = (n: number | null | undefined) => {

  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return v >= 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(6)}`;
};
