#!/usr/bin/env python3
"""
Seed the Assay registry with real creators + short factual sources, then (optionally)
run a batch of research tasks through the spending brain so the dashboard shows genuine,
non-synthetic volume.

Usage:
    python scripts/seed.py                 # seed creators + sources only
    python scripts/seed.py --run           # seed, then run the demo task batch
    ASSAY_MOCK_PAY=1 python scripts/seed.py --run   # offline dev (fake settlement ids)

Sources are intentionally overlapping in topic clusters (Arc/USDC, embeddings/RAG,
LangGraph agents) so the ASSAY engine has to REFUSE redundant buys — that is the feature
we want the dashboard to demonstrate.
"""
from __future__ import annotations

import argparse
import os
import sys

import httpx

BACKEND = os.environ.get("ASSAY_BACKEND_URL", "http://localhost:4000")

# --- Creators (each gets a distinct testnet wallet) ---------------------------------
CREATORS = [
    ("Ada Lovelace",     "0x1111111111111111111111111111111111111111"),
    ("Grace Hopper",     "0x2222222222222222222222222222222222222222"),
    ("Alan Turing",      "0x3333333333333333333333333333333333333333"),
    ("Katherine Johnson","0x4444444444444444444444444444444444444444"),
    ("Claude Shannon",   "0x5555555555555555555555555555555555555555"),
]

# --- Sources: (creator_index, title, abstract, content, price, tags, quality_prior) --
# Deliberate topic clusters create overlap → refusals.
SOURCES = [
    # Cluster A — Arc / USDC / nanopayments (high overlap on purpose)
    (0, "How USDC settles on Arc testnet",
     "Mechanics of stablecoin settlement on the Arc L1 testnet: finality, gas model, and the USDC contract.",
     "Arc finalizes blocks in ~1s. USDC is a native-gas-adjacent asset; transfers settle with sub-cent fees. "
     "Settlement proofs are the tx hash on the Arc explorer. Testnet USDC is obtained from the faucet.",
     0.0020, ["arc", "usdc", "settlement", "l1"], 0.85),
    (1, "Circle Gateway nanopayments explained",
     "Gateway batches many sub-cent x402 payments into one on-chain settlement, making per-call micropayments viable.",
     "Gateway aggregates authorized transfers off-chain, then settles a batch on Arc. This amortizes gas across "
     "hundreds of nanopayments so a $0.002 API call is economical. Each call carries an x402 authorization.",
     0.0025, ["circle", "gateway", "nanopayments", "x402"], 0.9),
    (2, "The x402 payment-required flow",
     "How HTTP 402 drives machine payments: challenge headers, the X-PAYMENT header, and retry semantics.",
     "An unpaid GET returns 402 with price and payTo. The client authorizes a transfer and retries with an "
     "X-PAYMENT header; the seller verifies and returns content plus a settlement id. Idempotent on the proof.",
     0.0015, ["x402", "http", "payments", "protocol"], 0.8),
    (0, "USDC faucet and testnet ops (redundant-ish)",
     "Getting testnet USDC on Arc and checking balances — overlaps heavily with core Arc settlement material.",
     "Use the Arc faucet to mint testnet USDC to your agent wallet. Check balances via the RPC. Settlement is "
     "the same 1s-finality path as mainnet-like behavior. Fees remain sub-cent.",
     0.0030, ["arc", "usdc", "faucet", "testnet"], 0.55),

    # Cluster B — embeddings / retrieval / VoI
    (2, "Cosine similarity for relevance ranking",
     "Why cosine similarity of embeddings approximates semantic relevance and how to normalize vectors.",
     "Cosine measures angle, not magnitude, so normalized embeddings give scores in [-1,1]. For retrieval, rank "
     "candidates by cosine(query, doc). Deduplicate near-identical docs by high pairwise cosine (novelty penalty).",
     0.0018, ["embeddings", "cosine", "retrieval", "nlp"], 0.85),
    (3, "Value-of-information for agent purchasing",
     "A decision-theoretic framing: expected marginal information gain per dollar, and a stopping rule.",
     "VoI = expected_marginal_gain / price. An agent should buy while marginal gain per dollar exceeds a threshold, "
     "penalizing overlap with already-bought sources. When the next-best VoI falls below threshold, STOP buying.",
     0.0040, ["voi", "decision-theory", "agents", "budget"], 0.95),
    (4, "Portfolio selection under a fixed budget",
     "Greedy vs knapsack allocation when picking which information sources to buy within a hard budget cap.",
     "With a fixed budget, selecting sources is a knapsack-like problem. A greedy VoI-ranked pass is a strong "
     "heuristic: take highest gain-per-dollar first, stop when budget or the marginal threshold binds.",
     0.0035, ["portfolio", "knapsack", "budget", "optimization"], 0.8),

    # Cluster C — LangGraph / agent architecture
    (1, "Building state machines with LangGraph",
     "Modeling an agent as explicit nodes and edges: intake, discover, decide, act, synthesize.",
     "LangGraph makes the node topology inspectable. Each node mutates typed state and can emit events for a UI. "
     "Edges define control flow; conditional edges branch on state. Great for auditable, streaming agents.",
     0.0022, ["langgraph", "agents", "state-machine", "python"], 0.85),
    (2, "Streaming agent decisions to a UI over SSE",
     "Server-sent events let a web client watch an agent think in real time — including refusals.",
     "Emit a structured event per decision. SSE keeps a single HTTP connection open; the browser's EventSource "
     "renders each BUY/SKIP/CACHE as it arrives. Surface rationales so reviewers see WHY, not just what.",
     0.0016, ["sse", "streaming", "ui", "agents"], 0.75),

    # Cluster D — a couple of low-relevance distractors (should be SKIPPED on most tasks)
    (3, "A short history of mechanical calculators",
     "From the Pascaline to the Difference Engine — background trivia, low relevance to payments or agents.",
     "Pascal's calculator (1642) did addition and subtraction. Babbage's Difference Engine automated polynomial "
     "tables. Interesting history, but not information a payments agent would value for most tasks.",
     0.0020, ["history", "computing", "trivia"], 0.5),
    (4, "Sourdough hydration ratios",
     "Baker's percentages for bread — a deliberate off-topic distractor to test relevance filtering.",
     "Hydration is water weight divided by flour weight. 75% hydration yields an open crumb. Totally irrelevant "
     "to research-agent spending decisions; a good agent should refuse to buy this for a tech task.",
     0.0012, ["baking", "food", "distractor"], 0.4),
]

# --- Demo task batch (some repeats to exercise cross-task cache + repeat-task metric) -
TASKS = [
    ("How do nanopayments settle on Arc using x402 and Gateway?", 0.010),
    ("What is value-of-information and how should an agent decide what to buy?", 0.010),
    ("How do I build a streaming LangGraph agent that shows its decisions?", 0.008),
    ("Explain cosine similarity for ranking retrieved documents.", 0.006),
    ("How do nanopayments settle on Arc using x402 and Gateway?", 0.010),   # repeat → cache
    ("How should an agent allocate a fixed budget across information sources?", 0.009),
    ("What is value-of-information and how should an agent decide what to buy?", 0.010),  # repeat
    ("How do nanopayments settle on Arc using x402 and Gateway?", 0.010),   # repeat again
]


def seed(client: httpx.Client) -> None:
    print(f"→ seeding registry at {BACKEND}")
    creator_ids: list[str] = []
    for name, wallet in CREATORS:
        r = client.post(f"{BACKEND}/creators", json={"name": name, "walletAddress": wallet})
        r.raise_for_status()
        creator_ids.append(r.json()["id"])
        print(f"  creator: {name}  {wallet[:10]}…")

    for ci, title, abstract, content, price, tags, qp in SOURCES:
        r = client.post(f"{BACKEND}/sources", json={
            "creatorId": creator_ids[ci], "title": title, "abstract": abstract,
            "content": content, "price": price, "tags": tags, "qualityPrior": qp,
        })
        r.raise_for_status()
        print(f"  source:  ${price:.4f}  {title}")
    print(f"✓ seeded {len(CREATORS)} creators, {len(SOURCES)} sources")


def run_tasks() -> None:
    # Import here so seeding works even without the agent deps installed.
    from assay.graph import run_task  # noqa: E402

    print("\n→ running demo task batch through the spending brain")
    for i, (prompt, budget) in enumerate(TASKS, 1):
        print(f"\n=== task {i}/{len(TASKS)}  (budget ${budget:.4f}) ===\n{prompt}")
        state = run_task(prompt, budget, backend_url=BACKEND)
        print(f"  spent ${state.spent:.4f} · {len(state.payments)} paid")
    print("\n✓ task batch complete — check the dashboard for live metrics")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", action="store_true", help="run the demo task batch after seeding")
    ap.add_argument("--tasks-only", action="store_true", help="skip seeding, only run tasks")
    args = ap.parse_args()

    # Make the agent package importable when run from repo root.
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "agent"))

    with httpx.Client(timeout=30.0) as client:
        try:
            client.get(f"{BACKEND}/health").raise_for_status()
        except Exception as e:  # noqa: BLE001
            print(f"✗ backend not reachable at {BACKEND}: {e}", file=sys.stderr)
            return 1
        if not args.tasks_only:
            seed(client)

    if args.run or args.tasks_only:
        run_tasks()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
