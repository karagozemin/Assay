"""
Batch runner — drive many REAL research tasks end-to-end to build genuine,
non-synthetic volume for the metrics dashboard and payout ledger.

Every task runs the full LangGraph pipeline (DISCOVER → ASSAY → PAY → SYNTHESIZE)
against the live backend. With ASSAY_MOCK_PAY=0 each BUY settles a real testnet USDC
nanopayment via Circle Gateway on Arc.

The task list is deliberately varied so the ledger shows agency, not "buy everything":
  * on-topic clusters that trigger novelty SKIPs (overlap with what was just bought)
  * off-topic tasks that trigger relevance SKIPs (nothing worth buying)
  * repeated prompts that trigger CACHE hits (reused free within TTL)

Usage:
  ASSAY_MOCK_PAY=0 python scripts/batch_run.py            # full real batch
  ASSAY_MOCK_PAY=0 python scripts/batch_run.py 8          # first 8 tasks only
"""
import sys
from collections import Counter

sys.path.insert(0, ".")
from agent.assay.graph import run_task

BACKEND = "http://localhost:4000"

# (prompt, budget). Repeats are intentional — they should CACHE-hit the 2nd time.
TASKS = [
    ("How does USDC settle on the Arc testnet and how do x402 nanopayments work?", 0.02),
    ("Explain Circle Gateway nanopayment batching for sub-cent API calls.", 0.02),
    ("What is the x402 402-Payment-Required flow and how does a client pay?", 0.015),
    ("How do I get testnet USDC and check balances on Arc?", 0.015),
    ("How does an agent rank sources by relevance using embeddings?", 0.02),
    ("What is value-of-information and how should an agent decide what to buy?", 0.025),
    ("How do you allocate a fixed budget as a portfolio selection problem?", 0.025),
    ("How do I build an inspectable agent state machine with LangGraph?", 0.02),
    ("How do I stream an agent's decisions to a web UI over SSE?", 0.015),
    # --- repeats (expect CACHE hits) ---
    ("How does USDC settle on the Arc testnet and how do x402 nanopayments work?", 0.02),
    ("What is value-of-information and how should an agent decide what to buy?", 0.025),
    # --- off-topic (expect mostly SKIPs on relevance) ---
    ("What is the ideal hydration ratio for sourdough bread?", 0.02),
    ("Give a short history of mechanical calculators.", 0.015),
    # --- broad synthesis task (should buy a diverse basket, then stop) ---
    ("Design an agent that pays creators per use for research and justify its buys.", 0.03),
]


def make_emit(tag):
    def emit(ev, data):
        if ev == "decision":
            print(f"  [{tag}] {data['decision']:5} voi={str(data['voi']):>8} "
                  f"rel={data['relevance']:.3f} nov={data['novelty']:.3f} "
                  f":: {data['title'][:40]}")
        elif ev == "pay_done":
            print(f"  [{tag}] PAID ${data['amount']:.4f} -> {data['creator']}  "
                  f"proof={data['proof'][:20]}")
    return emit


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else len(TASKS)
    tasks = TASKS[:limit]

    totals = Counter()
    total_spent = 0.0
    total_paid_calls = 0

    for i, (prompt, budget) in enumerate(tasks, 1):
        tag = f"{i:02d}/{len(tasks)}"
        print(f"\n=== TASK {tag}: {prompt[:70]} (budget ${budget}) ===")
        try:
            state = run_task(prompt, budget, make_emit(tag), backend_url=BACKEND)
        except Exception as e:  # keep the batch going; log the failure
            print(f"  [{tag}] ERROR: {e}")
            continue
        mix = Counter(d.decision for d in state.decisions)
        totals.update(mix)
        total_spent += state.spent
        paid = sum(1 for d in state.decisions if d.decision == "BUY")
        total_paid_calls += paid
        print(f"  [{tag}] spent=${round(state.spent,6)} mix={dict(mix)}")

    print("\n" + "=" * 70)
    print("BATCH COMPLETE")
    print(f"  tasks run:        {len(tasks)}")
    print(f"  decision mix:     {dict(totals)}")
    print(f"  paid calls (BUY): {total_paid_calls}")
    print(f"  total spent:      ${round(total_spent, 6)} testnet USDC")
    buys = totals.get('BUY', 0)
    skips = totals.get('SKIP', 0)
    if skips:
        print(f"  buy/skip ratio:   {round(buys / skips, 3)}")
    print("=" * 70)


if __name__ == "__main__":
    main()
