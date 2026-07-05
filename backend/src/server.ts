/**
 * Assay backend server.
 *
 *  - Source Registry:      creators + sources (metadata only on /discover)
 *  - x402 seller endpoint:  GET /content/:sourceId  → 402 unless paid to that creator's wallet
 *  - Ledger:               append-only decisions + payments, written by the agent
 *  - Payouts + Metrics:    aggregate views for the dashboard
 */
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import { formatUnits } from "viem";
import { randomUUID } from "node:crypto";
import { ARC, verifyRegistrationTx } from "./arc.ts";

import { embed } from "./embed.ts";
import { requirePayment, type PaymentInfo } from "./x402.ts";
import { settle, paymasterReady } from "./paymaster.ts";
import {
  registerAuthorization,
  authorizeSpend,
  refundSpend,
  type SignedAuthorization,
} from "./mandate.ts";
import * as store from "./db.ts";



const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

type PaidRequest = Request & { payment?: PaymentInfo };

const asDollars = (raw: string) => Number(formatUnits(BigInt(raw), 6));

/* --------------------------------- health -------------------------------- */

app.get("/health", (_req, res) => {
  res.json({ ok: true, network: ARC.NETWORK, db: store.DB_PATH });
});

/* -------------------------------- creators ------------------------------- */

app.post("/creators", async (req, res) => {
  const { name, walletAddress, proofTx } = req.body ?? {};
  if (!name || !walletAddress) {
    return res.status(400).json({ error: "name and walletAddress are required" });
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return res.status(400).json({ error: "walletAddress must be a 0x EVM address" });
  }
  if (!proofTx) {
    return res
      .status(400)
      .json({ error: "proofTx is required — register from an Arc wallet transaction" });
  }
  // A wallet is a unique identity; a display name must also be unique. Reject dupes
  // rather than silently creating a second creator that could impersonate the first.
  if (store.getCreatorByWallet(walletAddress)) {
    return res
      .status(409)
      .json({ error: "a creator with this wallet address is already registered" });
  }
  if (store.getCreatorByName(name)) {
    return res
      .status(409)
      .json({ error: "a creator with this display name already exists" });
  }
  // Proof of wallet control: the proofTx must be an on-chain Arc transaction sent
  // FROM this wallet. Without it, anyone could register someone else's address.
  try {
    await verifyRegistrationTx(String(proofTx), walletAddress);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "proofTx verification failed" });
  }
  res.status(201).json(store.createCreator(name, walletAddress, String(proofTx)));
});



app.get("/creators", (_req, res) => res.json(store.listCreators()));

/* -------------------------------- sources -------------------------------- */

/** Register a source. Embedding is computed server-side from title+abstract. */
app.post("/sources", (req, res) => {
  const {
    creatorId,
    title,
    abstract,
    content,
    price,
    tags = [],
    qualityPrior = 0.7,
  } = req.body ?? {};

  if (!creatorId || !title || !abstract || !content || price == null) {
    return res
      .status(400)
      .json({ error: "creatorId, title, abstract, content, price are required" });
  }
  if (!store.getCreator(creatorId)) {
    return res.status(404).json({ error: "creator not found" });
  }
  if (typeof price !== "number" || price <= 0 || price > 1) {
    return res.status(400).json({ error: "price must be a number in (0, 1] USDC" });
  }

  const embedding = embed(`${title}. ${abstract}`);
  const source = store.createSource({
    creatorId,
    title,
    abstract,
    content,
    price,
    tags: Array.isArray(tags) ? tags : [],
    qualityPrior: Math.max(0, Math.min(1, Number(qualityPrior))),
    embedding,
  });
  const { content: _omit, ...card } = source;
  res.status(201).json(card);
});

/**
 * DISCOVER — metadata + price + creator + embedding, but NEVER content.
 * This is what the agent's DISCOVER node calls to get candidates.
 */
app.get("/discover", (req, res) => {
  const q = String(req.query.q ?? "").toLowerCase();
  let cards = store.listSourceCards();

  // attach a lightweight creator summary
  const creators = new Map(store.listCreators().map((c) => [c.id, c]));
  let enriched = cards.map((c) => ({
    ...c,
    creator: creators.get(c.creatorId) ?? null,
    contentUrl: `/content/${c.id}`,
  }));

  if (q) {
    enriched = enriched.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.abstract.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  res.json(enriched);
});

/* ---------------------- x402-protected content route --------------------- */

/**
 * Dynamic x402 gate: look up the source, then run that creator's Gateway middleware with
 * the source's price. On success `req.payment` carries the settlement proof; we hand the
 * paid content back. The AGENT records the payment in the ledger via POST /ledger/payments
 * using the settlement id it receives here.
 */
app.get("/content/:sourceId", (req: Request, res: Response, next: NextFunction) => {
  const source = store.getSource(req.params.sourceId);
  if (!source) return res.status(404).json({ error: "source not found" });

  const creator = store.getCreator(source.creatorId);
  if (!creator) return res.status(404).json({ error: "creator not found" });

  const gate = requirePayment(creator.walletAddress, source.price);
  gate(req, res, (err?: unknown) => {
    if (err) return next(err);
    const pay = (req as PaidRequest).payment;
    if (!pay?.verified) {
      // Middleware should have already 402'd; this is a safety net.
      return res.status(402).json({ error: "payment required" });
    }
    const amountUsdc = asDollars(pay.amount);
    res.json({
      sourceId: source.id,
      creatorId: source.creatorId,
      title: source.title,
      content: source.content,
      price: source.price,
      payment: {
        payer: pay.payer,
        amountUsdc,
        network: pay.network,
        settlementId: pay.transaction ?? null,
        explorer: pay.transaction ? `${ARC.EXPLORER}/tx/${pay.transaction}` : null,
      },
    });
  });
});

/* ------------------------ spending authorizations ------------------------ */

/**
 * REGISTER a browser-signed spending mandate. The buyer signs an EIP-712
 * SpendingAuthorization (cap + expiry + nonce) with their wallet; we verify the
 * signature server-side and return a mandate id. Every subsequent /pay/settle for
 * this run MUST carry that id, and the backend enforces the signed cap. The cap
 * lives here — not in the UI — so bypassing the UI cannot overspend.
 */
app.post("/authorizations", async (req, res) => {
  try {
    const summary = await registerAuthorization(req.body as SignedAuthorization);
    res.status(201).json(summary);
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "invalid spending authorization" });
  }
});

/* ----------------------- buyer-side settlement --------------------------- */


/**
 * PAY — the agent's spending brain decided to BUY source :sourceId. It calls this and
 * the backend's funded buyer wallet runs the REAL x402 flow against that source's
 * protected /content endpoint (GET → 402 → Gateway nanopayment on Arc → retry),
 * returning the paid content plus the on-chain settlement proof. The agent then
 * records the payment via POST /ledger/payments using this proof.
 *
 * This is the single real-money chokepoint. If BUYER_PRIVATE_KEY is unset it 503s so
 * the failure is loud rather than silently mocked.
 */
app.post("/pay/settle", async (req, res) => {
  const { sourceId, authorizationId } = req.body ?? {};
  if (!sourceId) return res.status(400).json({ error: "sourceId is required" });
  if (!authorizationId) {
    return res
      .status(401)
      .json({ error: "authorizationId is required — sign a spending authorization first" });
  }

  const source = store.getSource(String(sourceId));
  if (!source) return res.status(404).json({ error: "source not found" });

  // ENFORCE the signed spending cap BEFORE anything else — BEFORE we even look at the
  // paymaster. This debits the mandate's running ledger; if the payment would exceed the
  // buyer's signed cap (or the mandate is unknown/expired) it is refused here and the
  // paymaster never runs. The cap lives server-side, so calling /pay/settle directly and
  // bypassing the UI cannot exceed the signed cap. This is the chokepoint that makes the
  // mandate real — and it holds independent of whether a funded wallet is configured.
  const spend = authorizeSpend(String(authorizationId), source.price);
  if (!spend.ok) {
    return res.status(403).json({ error: spend.error, ...spend });
  }

  // TEST-ONLY settlement stub (ASSAY_TEST_SETTLE=1). This runs ONLY after the real
  // authorizeSpend cap check above has passed, so it proves the route handler wires to
  // the mandate ledger before paying — WITHOUT a funded wallet or real testnet USDC.
  // It never touches the paymaster and is inert unless the env flag is explicitly set.
  if (process.env.ASSAY_TEST_SETTLE === "1") {
    const proof = `test-settle-${randomUUID()}`;
    return res.json({
      sourceId: source.id,
      creatorId: source.creatorId,
      title: source.title,
      content: "[TEST SETTLE] cap check passed; paymaster bypassed",
      price: source.price,
      testSettle: true,
      spend, // running mandate ledger: capUsdc / spentUsdc / remainingUsdc
      payment: {
        payer: null,
        amountUsdc: source.price,
        network: ARC.NETWORK,
        settlementId: proof,
        explorer: null,
      },
    });
  }

  if (!paymasterReady()) {
    // Cap already passed & debited; if we can't actually pay, release the reservation so
    // the buyer's cap isn't consumed by a payment that never happened.
    refundSpend(String(authorizationId), source.price);
    return res
      .status(503)
      .json({ error: "paymaster not configured — set BUYER_PRIVATE_KEY in backend/.env.local" });
  }


  const port = Number(process.env.PORT ?? 4000);
  const absoluteUrl = `http://127.0.0.1:${port}/content/${source.id}`;

  try {
    const result = await settle(source.id, absoluteUrl);

    res.json({
      sourceId: source.id,
      creatorId: source.creatorId,
      title: source.title,
      content: result.content,
      price: source.price,
      payment: {
        payer: result.payer,
        amountUsdc: result.amountUsdc,
        network: result.network,
        settlementId: result.proof,
        explorer: result.explorer,
      },
    });
  } catch (err: any) {
    // Settlement failed AFTER we debited the mandate — refund the reservation so the
    // buyer's cap isn't consumed by a payment that never actually happened.
    refundSpend(String(authorizationId), source.price);
    console.error(`[pay/settle] source ${source.id} failed:`, err?.message ?? err);
    res.status(502).json({ error: err?.message ?? "settlement failed" });
  }
});


/* --------------------------------- tasks --------------------------------- */

app.post("/tasks", (req, res) => {

  const { prompt, budget } = req.body ?? {};
  if (!prompt || budget == null) {
    return res.status(400).json({ error: "prompt and budget are required" });
  }
  res.status(201).json(store.createTask(String(prompt), Number(budget)));
});

app.get("/tasks", (_req, res) => res.json(store.listTasks()));

app.get("/tasks/:id", (req, res) => {
  const task = store.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "task not found" });
  res.json({
    task,
    decisions: store.listDecisions(task.id),
    payments: store.listPayments(task.id),
  });
});

/* ------------------------------- ledger ---------------------------------- */

/** The agent posts every decision here (BUY / SKIP / CACHE) with its rationale. */
app.post("/ledger/decisions", (req, res) => {
  const d = req.body ?? {};
  const required = ["taskId", "sourceId", "creatorId", "decision", "rationale"];
  for (const k of required) {
    if (d[k] == null) return res.status(400).json({ error: `${k} is required` });
  }
  if (!["BUY", "SKIP", "CACHE"].includes(d.decision)) {
    return res.status(400).json({ error: "decision must be BUY | SKIP | CACHE" });
  }
  res.status(201).json(
    store.recordDecision({
      taskId: d.taskId,
      sourceId: d.sourceId,
      creatorId: d.creatorId,
      decision: d.decision,
      rationale: String(d.rationale),
      relevance: Number(d.relevance ?? 0),
      novelty: Number(d.novelty ?? 0),
      expectedGain: Number(d.expectedGain ?? 0),
      voi: Number(d.voi ?? 0),
      price: Number(d.price ?? 0),
    }),
  );
});

/** The agent posts a settled payment here (with the x402 settlement proof). */
app.post("/ledger/payments", (req, res) => {
  const p = req.body ?? {};
  const required = ["taskId", "sourceId", "creatorId", "amount", "proof"];
  for (const k of required) {
    if (p[k] == null) return res.status(400).json({ error: `${k} is required` });
  }
  res.status(201).json(
    store.recordPayment({
      taskId: p.taskId,
      sourceId: p.sourceId,
      creatorId: p.creatorId,
      amount: Number(p.amount),
      proof: String(p.proof),
      payer: String(p.payer ?? ""),
      network: String(p.network ?? ARC.NETWORK),
    }),
  );
});

app.get("/ledger/decisions", (req, res) => {
  res.json(store.listDecisions(req.query.taskId ? String(req.query.taskId) : undefined));
});

app.get("/ledger/payments", (req, res) => {
  res.json(store.listPayments(req.query.taskId ? String(req.query.taskId) : undefined));
});

/* ---------------------------- payouts / metrics -------------------------- */

app.get("/payouts", (_req, res) => res.json(store.creatorPayouts()));

app.get("/metrics", (_req, res) => res.json(store.metrics()));

/* --------------------------------- boot ---------------------------------- */

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`Assay backend on http://localhost:${PORT}`);
  console.log(`  registry:  POST /creators, POST /sources, GET /discover`);
  console.log(`  x402:      GET  /content/:sourceId`);
  console.log(`  ledger:    POST /ledger/decisions, POST /ledger/payments`);
  console.log(`  dashboard: GET  /payouts, GET /metrics`);
});
