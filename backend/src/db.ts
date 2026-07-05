import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Creator,
  Source,
  SourceCard,
  Decision,
  DecisionKind,
  Payment,
  Task,
} from "./types.ts";

const DB_PATH = resolve(process.env.ASSAY_DB ?? "data/assay.sqlite");
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS creators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    walletAddress TEXT NOT NULL,
    proofTx TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );


  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    creatorId TEXT NOT NULL REFERENCES creators(id),
    title TEXT NOT NULL,
    abstract TEXT NOT NULL,
    content TEXT NOT NULL,
    price REAL NOT NULL,
    tags TEXT NOT NULL,
    qualityPrior REAL NOT NULL,
    embedding TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    budget REAL NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,
    sourceId TEXT NOT NULL,
    creatorId TEXT NOT NULL,
    decision TEXT NOT NULL,
    rationale TEXT NOT NULL,
    relevance REAL NOT NULL,
    novelty REAL NOT NULL,
    expectedGain REAL NOT NULL,
    voi REAL NOT NULL,
    price REAL NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,
    sourceId TEXT NOT NULL,
    creatorId TEXT NOT NULL,
    amount REAL NOT NULL,
    proof TEXT NOT NULL,
    payer TEXT NOT NULL,
    network TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sources_creator ON sources(creatorId);
  CREATE INDEX IF NOT EXISTS idx_decisions_task ON decisions(taskId);
  CREATE INDEX IF NOT EXISTS idx_payments_task ON payments(taskId);
  CREATE INDEX IF NOT EXISTS idx_payments_creator ON payments(creatorId);
`);

// Migrate older DBs that predate the on-chain proof column.
const creatorCols = (
  db.prepare("PRAGMA table_info(creators)").all() as unknown as { name: string }[]
).map((c) => c.name);
if (!creatorCols.includes("proofTx")) {
  db.exec("ALTER TABLE creators ADD COLUMN proofTx TEXT NOT NULL DEFAULT '';");
}


const now = () => new Date().toISOString();

// node:sqlite returns Record<string, SQLOutputValue>; cast through unknown to our row types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rows<T>(stmt: any, ...args: unknown[]): T[] {
  return stmt.all(...args) as unknown as T[];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function row<T>(stmt: any, ...args: unknown[]): T | undefined {
  return stmt.get(...args) as unknown as T | undefined;
}

/* ------------------------------- creators ------------------------------- */

export function createCreator(
  name: string,
  walletAddress: string,
  proofTx: string,
): Creator {
  const c: Creator = {
    id: randomUUID(),
    name,
    walletAddress,
    proofTx,
    createdAt: now(),
  };
  db.prepare(
    "INSERT INTO creators (id, name, walletAddress, proofTx, createdAt) VALUES (?, ?, ?, ?, ?)",
  ).run(c.id, c.name, c.walletAddress, c.proofTx, c.createdAt);
  return c;
}


export function getCreator(id: string): Creator | undefined {
  return row<Creator>(db.prepare("SELECT * FROM creators WHERE id = ?"), id);
}

/** Case-insensitive lookup by wallet address (wallets are a unique identity). */
export function getCreatorByWallet(walletAddress: string): Creator | undefined {
  return row<Creator>(
    db.prepare("SELECT * FROM creators WHERE lower(walletAddress) = lower(?)"),
    walletAddress,
  );
}

/** Case-insensitive lookup by display name. */
export function getCreatorByName(name: string): Creator | undefined {
  return row<Creator>(
    db.prepare("SELECT * FROM creators WHERE lower(name) = lower(?)"),
    name,
  );
}

export function listCreators(): Creator[] {
  return rows<Creator>(db.prepare("SELECT * FROM creators ORDER BY createdAt"));
}

/* -------------------------------- sources -------------------------------- */

interface SourceRow {
  id: string;
  creatorId: string;
  title: string;
  abstract: string;
  content: string;
  price: number;
  tags: string;
  qualityPrior: number;
  embedding: string;
  createdAt: string;
}

function rowToSource(r: SourceRow): Source {
  return {
    ...r,
    tags: JSON.parse(r.tags),
    embedding: JSON.parse(r.embedding),
  };
}

export function createSource(input: {
  creatorId: string;
  title: string;
  abstract: string;
  content: string;
  price: number;
  tags: string[];
  qualityPrior: number;
  embedding: number[];
}): Source {
  const s: Source = { id: randomUUID(), createdAt: now(), ...input };
  db.prepare(
    `INSERT INTO sources
       (id, creatorId, title, abstract, content, price, tags, qualityPrior, embedding, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    s.id,
    s.creatorId,
    s.title,
    s.abstract,
    s.content,
    s.price,
    JSON.stringify(s.tags),
    s.qualityPrior,
    JSON.stringify(s.embedding),
    s.createdAt,
  );
  return s;
}

export function getSource(id: string): Source | undefined {
  const r = row<SourceRow>(db.prepare("SELECT * FROM sources WHERE id = ?"), id);
  return r ? rowToSource(r) : undefined;
}

/** Full sources (includes embeddings) — for the agent's DISCOVER/ASSAY. Never leaks content by default. */
export function listSourceCards(): SourceCard[] {
  const list = rows<SourceRow>(db.prepare("SELECT * FROM sources ORDER BY createdAt"));
  return list.map((r) => {
    const { content: _content, ...rest } = rowToSource(r);
    return rest;
  });
}

export function listSources(): Source[] {
  const list = rows<SourceRow>(db.prepare("SELECT * FROM sources ORDER BY createdAt"));
  return list.map(rowToSource);
}

/* --------------------------------- tasks --------------------------------- */

export function createTask(prompt: string, budget: number): Task {
  const t: Task = { id: randomUUID(), prompt, budget, createdAt: now() };
  db.prepare("INSERT INTO tasks (id, prompt, budget, createdAt) VALUES (?, ?, ?, ?)").run(
    t.id,
    t.prompt,
    t.budget,
    t.createdAt,
  );
  return t;
}

export function getTask(id: string): Task | undefined {
  return row<Task>(db.prepare("SELECT * FROM tasks WHERE id = ?"), id);
}

export function listTasks(): Task[] {
  return rows<Task>(db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC"));
}

/* ------------------------------- decisions ------------------------------- */

export function recordDecision(input: {
  taskId: string;
  sourceId: string;
  creatorId: string;
  decision: DecisionKind;
  rationale: string;
  relevance: number;
  novelty: number;
  expectedGain: number;
  voi: number;
  price: number;
}): Decision {
  const d: Decision = { id: randomUUID(), createdAt: now(), ...input };
  db.prepare(
    `INSERT INTO decisions
       (id, taskId, sourceId, creatorId, decision, rationale, relevance, novelty, expectedGain, voi, price, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    d.id,
    d.taskId,
    d.sourceId,
    d.creatorId,
    d.decision,
    d.rationale,
    d.relevance,
    d.novelty,
    d.expectedGain,
    d.voi,
    d.price,
    d.createdAt,
  );
  return d;
}

export function listDecisions(taskId?: string): Decision[] {
  if (taskId) {
    return rows<Decision>(
      db.prepare("SELECT * FROM decisions WHERE taskId = ? ORDER BY createdAt"),
      taskId,
    );
  }
  return rows<Decision>(db.prepare("SELECT * FROM decisions ORDER BY createdAt DESC"));
}

/* -------------------------------- payments ------------------------------- */

export function recordPayment(input: {
  taskId: string;
  sourceId: string;
  creatorId: string;
  amount: number;
  proof: string;
  payer: string;
  network: string;
}): Payment {
  const p: Payment = { id: randomUUID(), createdAt: now(), ...input };
  db.prepare(
    `INSERT INTO payments
       (id, taskId, sourceId, creatorId, amount, proof, payer, network, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    p.id,
    p.taskId,
    p.sourceId,
    p.creatorId,
    p.amount,
    p.proof,
    p.payer,
    p.network,
    p.createdAt,
  );
  return p;
}

export function listPayments(taskId?: string): Payment[] {
  if (taskId) {
    return rows<Payment>(
      db.prepare("SELECT * FROM payments WHERE taskId = ? ORDER BY createdAt"),
      taskId,
    );
  }
  return rows<Payment>(db.prepare("SELECT * FROM payments ORDER BY createdAt DESC"));
}

/* --------------------------- payout / metrics ---------------------------- */

export interface CreatorPayout {
  creatorId: string;
  name: string;
  walletAddress: string;
  totalEarned: number;
  paidCalls: number;
}

export function creatorPayouts(): CreatorPayout[] {
  return db
    .prepare(
      `SELECT c.id AS creatorId, c.name, c.walletAddress,
              COALESCE(SUM(p.amount), 0) AS totalEarned,
              COUNT(p.id) AS paidCalls
       FROM creators c
       LEFT JOIN payments p ON p.creatorId = c.id
       GROUP BY c.id
       ORDER BY totalEarned DESC`,
    )
    .all() as unknown as CreatorPayout[];
}

export interface Metrics {
  totalPaidCalls: number;
  totalUsdcSettled: number;
  avgPaymentSize: number;
  uniqueCreatorsPaid: number;
  uniqueTasksRun: number;
  repeatTaskCount: number;
  buyCount: number;
  skipCount: number;
  cacheCount: number;
  buySkipRatio: number;
}

export function metrics(): Metrics {
  const pay = db
    .prepare(
      `SELECT COUNT(*) AS calls, COALESCE(SUM(amount),0) AS total,
              COUNT(DISTINCT creatorId) AS creators
       FROM payments`,
    )
    .get() as unknown as { calls: number; total: number; creators: number };

  const tasksRun = (
    db.prepare("SELECT COUNT(*) AS n FROM tasks").get() as unknown as { n: number }
  ).n;

  // repeat tasks = prompts that appear more than once
  const repeat = (
    db
      .prepare(
        `SELECT COALESCE(SUM(cnt - 1), 0) AS repeats FROM (
           SELECT COUNT(*) AS cnt FROM tasks GROUP BY prompt HAVING COUNT(*) > 1
         )`,
      )
      .get() as unknown as { repeats: number }
  ).repeats;

  const dec = db
    .prepare(
      `SELECT
         SUM(CASE WHEN decision='BUY' THEN 1 ELSE 0 END) AS buys,
         SUM(CASE WHEN decision='SKIP' THEN 1 ELSE 0 END) AS skips,
         SUM(CASE WHEN decision='CACHE' THEN 1 ELSE 0 END) AS caches
       FROM decisions`,
    )
    .get() as unknown as { buys: number | null; skips: number | null; caches: number | null };

  const buyCount = dec.buys ?? 0;
  const skipCount = dec.skips ?? 0;
  const cacheCount = dec.caches ?? 0;

  return {
    totalPaidCalls: pay.calls,
    totalUsdcSettled: pay.total,
    avgPaymentSize: pay.calls ? pay.total / pay.calls : 0,
    uniqueCreatorsPaid: pay.creators,
    uniqueTasksRun: tasksRun,
    repeatTaskCount: repeat,
    buyCount,
    skipCount,
    cacheCount,
    buySkipRatio: skipCount ? buyCount / skipCount : buyCount,
  };
}

export { DB_PATH, db };
