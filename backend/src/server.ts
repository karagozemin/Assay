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
import { createPublicClient, formatUnits, http } from "viem";
import { randomUUID } from "node:crypto";
import { ARC, verifyRegistrationTx } from "./arc.ts";

import { embed } from "./embed.ts";
import { requirePayment, type PaymentInfo } from "./x402.ts";
import { settle, paymasterReady } from "./paymaster.ts";
import {
  registerAuthorization,
  authorizeSpend,
  refundSpend,
  getMandateSummary,
  type SignedAuthorization,
} from "./mandate.ts";
import * as store from "./db.ts";
import { loadBackendConfig } from "./config.ts";
import { classifyPaymentProvenance } from "./provenance.ts";
import {
  buildCanonicalRunReceipt,
  canonicalJson,
  receiptCalldata,
  receiptHash,
} from "./receipt.ts";
import { verifyReceiptAnchor, type ReceiptAnchorRpc } from "./receiptAnchor.ts";
import { buildReceiptArtifact, writeReceiptArtifact } from "./receiptArtifact.ts";
import { runReceiptView } from "./receiptView.ts";

const config = loadBackendConfig();
const arcMainnetClient = createPublicClient({ transport: http(config.arcMainnet.rpcUrl) });
const app = express();
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

type PaidRequest = Request & { payment?: PaymentInfo };

const asDollars = (raw: string) => Number(formatUnits(BigInt(raw), 6));

/* --------------------------------- health -------------------------------- */

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "assay-backend", runtime: config.runtime });
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
        provenance: "arc_testnet_x402",
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
        provenance: "demo_test_settlement",
      },
    });
  }

  if (!paymasterReady()) {
    // Cap already passed & debited; if we can't actually pay, release the reservation so
    // the buyer's cap isn't consumed by a payment that never happened.
    refundSpend(String(authorizationId), source.price);
    return res
      .status(503)
      .json({ error: "Arc testnet x402 paymaster is not configured" });
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
        provenance: "arc_testnet_x402",
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

/* ------------------------ Arc mainnet run receipts ----------------------- */

const receiptView = (receipt: Parameters<typeof runReceiptView>[0]) =>
  runReceiptView(receipt, config.arcMainnet.explorerUrl);

app.post("/receipts/from-run", (req, res) => {
  const { taskId, authorizationId } = req.body ?? {};
  if (!taskId || !authorizationId) {
    return res.status(400).json({ error: "taskId and authorizationId are required" });
  }

  const existing = store.getRunReceiptForTask(String(taskId), String(authorizationId));
  if (existing) return res.json(receiptView(existing));

  const task = store.getTask(String(taskId));
  if (!task) return res.status(404).json({ error: "task not found" });
  const mandate = getMandateSummary(String(authorizationId));
  if (!mandate) {
    return res.status(404).json({
      error: "spending authorization not found; create the receipt before the backend restarts",
    });
  }

  try {
    const createdAt = new Date().toISOString();
    const canonicalReceipt = buildCanonicalRunReceipt({
      task,
      mandate,
      decisions: store.listDecisions(task.id),
      payments: store.listPayments(task.id),
      backendReceiptCreatedAt: createdAt,
    });
    const canonical = canonicalJson(canonicalReceipt);
    const hash = receiptHash(canonicalReceipt);
    const receipt = store.createRunReceipt({
      taskId: task.id,
      authorizationId: mandate.id,
      receiptHash: hash,
      canonicalJson: canonical,
      signer: mandate.signer.toLowerCase(),
      expectedCalldata: receiptCalldata(hash),
      chainId: config.arcMainnet.chainId,
      completionTimestamp: canonicalReceipt.completionTimestamp,
      createdAt,
    });
    return res.status(201).json(receiptView(receipt));
  } catch (error: any) {
    return res.status(400).json({ error: error?.message ?? "failed to create run receipt" });
  }
});

app.post("/receipts/:id/anchor", async (req, res) => {
  const receipt = store.getRunReceipt(req.params.id);
  if (!receipt) return res.status(404).json({ error: "run receipt not found" });
  const txHash = String(req.body?.txHash ?? "");
  if (receipt.anchorStatus === "verified") {
    if (receipt.txHash?.toLowerCase() !== txHash.toLowerCase()) {
      return res.status(409).json({ error: "run receipt is already anchored by another tx" });
    }
    return res.json(receiptView(receipt));
  }

  try {
    const verified = await verifyReceiptAnchor({
      client: arcMainnetClient as unknown as ReceiptAnchorRpc,
      txHash,
      signer: receipt.signer,
      expectedCalldata: receipt.expectedCalldata,
    });
    const explorerUrl = `${config.arcMainnet.explorerUrl}/tx/${verified.txHash}`;
    const anchored = store.markRunReceiptVerified({
      id: receipt.id,
      txHash: verified.txHash,
      blockNumber: verified.blockNumber,
      explorerUrl,
      verifiedAt: new Date().toISOString(),
    });
    try {
      writeReceiptArtifact(anchored, store.DB_PATH);
    } catch (artifactError) {
      console.error("[receipt] verified but artifact file write failed", artifactError);
    }
    return res.json(receiptView(anchored));
  } catch (error: any) {
    const message = error?.message ?? "Arc mainnet anchor verification failed";
    return res.status(message.includes("not mined yet") ? 409 : 400).json({ error: message });
  }
});

app.get("/receipts/:id/artifact", (req, res) => {
  const receipt = store.getRunReceipt(req.params.id);
  if (!receipt) return res.status(404).json({ error: "run receipt not found" });
  if (receipt.anchorStatus !== "verified") {
    return res.status(409).json({ error: "run receipt is not anchored yet" });
  }
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="mainnet-receipt-anchor-${receipt.id}.json"`,
  );
  return res.json(buildReceiptArtifact(receipt));
});

app.get("/receipts/:id", (req, res) => {
  const receipt = store.getRunReceipt(req.params.id);
  if (!receipt) return res.status(404).json({ error: "run receipt not found" });
  return res.json(receiptView(receipt));
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

/** The agent posts a payment-stage record; provenance determines settlement status. */
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
      provenance: classifyPaymentProvenance(
        String(p.proof),
        p.provenance,
        String(p.network ?? ARC.NETWORK),
      ),
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

app.listen(config.port, config.host, () => {
  console.log(`Assay backend on http://${config.host}:${config.port}`);
  console.log(`  registry:  POST /creators, POST /sources, GET /discover`);
  console.log(`  x402:      GET  /content/:sourceId`);
  console.log(`  ledger:    POST /ledger/decisions, POST /ledger/payments`);
  console.log(`  receipts:  POST /receipts/from-run, GET /receipts/:id`);
  console.log(`  dashboard: GET  /payouts, GET /metrics`);
});
