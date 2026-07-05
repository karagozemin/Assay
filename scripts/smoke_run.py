"""Smoke test: run one research task end-to-end against the live backend and print
the ASSAY decision stream. Used to verify candidates flow, decisions are made, and a
payment settles. Run with ASSAY_MOCK_PAY=1 for an offline settlement id."""
import sys
from collections import Counter

sys.path.insert(0, ".")
from agent.assay.graph import run_task


def emit(ev, data):
    if ev == "decision":
        print(f"  {data['decision']:5} voi={data['voi']:>8} "
              f"rel={data['relevance']:.3f} nov={data['novelty']:.3f} "
              f":: {data['title'][:42]}")
    elif ev == "pay_done":
        print(f"  PAID ${data['amount']:.4f} -> {data['creator']}  proof={data['proof'][:22]}")
    elif ev == "synthesize":
        print(f"  SUMMARY cost=${data['cost']} bought={data['bought']} "
              f"skipped={data['skipped']} cached={data['cached']}")


if __name__ == "__main__":
    prompt = sys.argv[1] if len(sys.argv) > 1 else \
        "How do stablecoin nanopayments settle on Arc testnet?"
    budget = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
    print(f"=== TASK: {prompt} (budget ${budget}) ===")
    state = run_task(prompt, budget, emit, backend_url="http://localhost:4000")
    mix = dict(Counter(d.decision for d in state.decisions))
    print(f"candidates={len(state.candidates)} decisions={len(state.decisions)} "
          f"spent=${round(state.spent, 6)} mix={mix}")
