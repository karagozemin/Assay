/** Idempotent demo fixtures. These records are examples, not real creator identities. */
import {
  createCreator,
  createSource,
  createTask,
  getCreatorByName,
  listSources,
  listTasks,
  recordDecision,
  recordPayment,
} from "./db.ts";
import { embed } from "./embed.ts";

const creators = [
  ["[Demo] Arc Research", "0x1111111111111111111111111111111111111111"],
  ["[Demo] Gateway Notes", "0x2222222222222222222222222222222222222222"],
  ["[Demo] Agent Systems", "0x3333333333333333333333333333333333333333"],
  ["[Demo] Decision Lab", "0x4444444444444444444444444444444444444444"],
  ["[Demo] Retrieval Lab", "0x5555555555555555555555555555555555555555"],
] as const;

const sources = [
  [0, "How USDC settles on Arc testnet", "Arc testnet settlement, finality, gas, and USDC mechanics.", 0.002, ["arc", "usdc"]],
  [1, "Circle Gateway nanopayments explained", "How Gateway batches sub-cent x402 authorizations.", 0.0025, ["gateway", "x402"]],
  [2, "The x402 payment-required flow", "HTTP 402 challenges, payment headers, and retry semantics.", 0.0015, ["x402", "http"]],
  [0, "USDC faucet and testnet operations", "Obtaining testnet USDC and inspecting testnet balances.", 0.003, ["arc", "faucet"]],
  [4, "Cosine similarity for relevance ranking", "Embedding similarity, normalization, and retrieval ranking.", 0.0018, ["retrieval", "embeddings"]],
  [3, "Value-of-information for agent purchasing", "Expected marginal information gain per dollar and stopping rules.", 0.004, ["voi", "agents"]],
  [3, "Portfolio selection under a fixed budget", "Greedy and knapsack-style allocation for information sources.", 0.0035, ["portfolio", "budget"]],
  [2, "Building state machines with LangGraph", "Explicit agent nodes, state transitions, and auditability.", 0.0022, ["langgraph", "agents"]],
  [2, "Streaming agent decisions over SSE", "Structured event streaming for BUY, SKIP, and CACHE decisions.", 0.0016, ["sse", "streaming"]],
  [4, "A short history of mechanical calculators", "A low-relevance distractor for refusal testing.", 0.002, ["history", "distractor"]],
  [4, "Sourdough hydration ratios", "An off-topic distractor for relevance filtering.", 0.0012, ["food", "distractor"]],
] as const;

const creatorIds = creators.map(([name, wallet]) => {
  const existing = getCreatorByName(name);
  return existing?.id ?? createCreator(name, wallet, "demo-fixture:not-onchain").id;
});

const existingTitles = new Set(listSources().map((source) => source.title));
let inserted = 0;
for (const [creatorIndex, title, abstract, price, tags] of sources) {
  if (existingTitles.has(title)) continue;
  createSource({
    creatorId: creatorIds[creatorIndex],
    title,
    abstract,
    content: `[DEMO FIXTURE] ${abstract}`,
    price,
    tags: [...tags],
    qualityPrior: (tags as readonly string[]).includes("distractor") ? 0.45 : 0.85,
    embedding: embed(`${title}. ${abstract}`),
  });
  inserted += 1;
}

const demoPrompt = "[DEMO FIXTURE] How do nanopayments settle on Arc?";
if (!listTasks().some((task) => task.prompt === demoPrompt)) {
  const task = createTask(demoPrompt, 0.02);
  const seededSources = listSources().filter((source) =>
    sources.some((fixture) => fixture[1] === source.title),
  );

  seededSources.forEach((source, index) => {
    const bought = index < 3;
    recordDecision({
      taskId: task.id,
      sourceId: source.id,
      creatorId: source.creatorId,
      decision: bought ? "BUY" : "SKIP",
      rationale: bought
        ? "[DEMO FIXTURE] Selected by the sample VoI ranking."
        : "[DEMO FIXTURE] Refused for relevance, overlap, or stopping threshold.",
      relevance: bought ? 0.9 - index * 0.05 : 0.2,
      novelty: bought ? 0.85 - index * 0.05 : 0.3,
      expectedGain: bought ? 0.75 - index * 0.05 : 0.06,
      voi: bought ? 300 - index * 40 : 20,
      price: source.price,
    });
    if (bought) {
      recordPayment({
        taskId: task.id,
        sourceId: source.id,
        creatorId: source.creatorId,
        amount: source.price,
        proof: `demo-seed-event-${index + 1}`,
        payer: "",
        network: "demo",
        provenance: "demo_test_settlement",
      });
    }
  });
}

console.log(
  `Demo fixtures ready: ${creators.length} creators, ${sources.length} sources, ` +
    "11 decisions, 3 demo/test payment events.",
);
