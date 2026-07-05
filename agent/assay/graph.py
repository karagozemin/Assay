"""
Assay spending-brain state machine (LangGraph).

Nodes:  INTAKE → DISCOVER → ASSAY → PAY → SYNTHESIZE → LEDGER-WRITE

The graph is written so it can run headless (CLI) OR stream events to the web UI. Every
node yields structured events through an `emit` callback so the AGENT RUN screen can show
ASSAY decisions — especially refusals — the instant they happen.

LangGraph is used to make the node topology explicit and inspectable. If langgraph isn't
installed the module falls back to a plain sequential runner with identical semantics, so
the agent always works for the demo.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from .client import AssayClient
from .engine import AssayConfig, Bought, Candidate, Decision, assay, ranked_table

EmitFn = Callable[[str, Dict[str, Any]], None]


@dataclass
class RunState:
    prompt: str
    budget: float
    task_id: str = ""
    candidates: List[Candidate] = field(default_factory=list)
    cards: Dict[str, Dict[str, Any]] = field(default_factory=dict)  # source_id -> discover card
    prior_bought: List[Bought] = field(default_factory=list)
    cache_hits: Dict[str, Bought] = field(default_factory=dict)
    decisions: List[Decision] = field(default_factory=list)
    bought_content: Dict[str, str] = field(default_factory=dict)
    payments: List[Dict[str, Any]] = field(default_factory=list)
    spent: float = 0.0
    answer: str = ""
    authorization_id: Optional[str] = None
    config: AssayConfig = field(default_factory=AssayConfig)



def _noop(_event: str, _data: Dict[str, Any]) -> None:
    pass


# ---- Nodes --------------------------------------------------------------------------
def node_intake(state: RunState, client: AssayClient, emit: EmitFn) -> RunState:
    task = client.create_task(state.prompt, state.budget)
    state.task_id = task["id"]
    emit("intake", {"taskId": state.task_id, "prompt": state.prompt, "budget": state.budget})
    return state


def node_discover(state: RunState, client: AssayClient, emit: EmitFn) -> RunState:
    # Retrieve the FULL candidate set — do NOT pre-filter by the prompt. The backend's
    # /discover keyword filter is a naive substring match; a full-sentence prompt matches
    # nothing and starves ASSAY of candidates (→ $0 spend). Semantic relevance is ASSAY's
    # job via embedding cosine similarity, so we hand it every source and let VoI rank them.
    cards = client.discover()

    for c in cards:
        state.cards[c["id"]] = c
        state.candidates.append(Candidate(
            id=c["id"], creator_id=c["creatorId"], title=c["title"],
            abstract=c["abstract"], price=float(c["price"]),
            quality_prior=float(c.get("qualityPrior", 0.7)),
            embedding=c["embedding"], creator_name=c.get("creator", {}).get("name", ""),
            tags=c.get("tags", []),
        ))
    # Seed cross-task novelty + cache from prior purchases.
    prior = client.prior_purchases(state.task_id)
    now = time.time()
    for p in prior:
        sid = p.get("sourceId")
        card = state.cards.get(sid)
        emb = card["embedding"] if card else None
        if emb is None:
            continue
        b = Bought(id=sid, embedding=emb, task_id=p.get("taskId"), bought_at=now)
        state.prior_bought.append(b)
        # If the same source was bought before AND is a candidate now → cache candidate.
        if sid in state.cards:
            state.cache_hits[sid] = b
    emit("discover", {"count": len(state.candidates),
                      "sources": [{"id": c.id, "title": c.title, "price": c.price,
                                   "creator": c.creator_name} for c in state.candidates],
                      "priorPurchases": len(state.prior_bought)})
    return state


def node_assay(state: RunState, client: AssayClient, emit: EmitFn) -> RunState:
    decisions = assay(
        candidates=state.candidates,
        task_prompt=state.prompt,
        budget=state.budget,
        already_bought=state.prior_bought,
        cache_hits=state.cache_hits,
        config=state.config,
    )
    state.decisions = decisions
    # Stream each decision individually — this is the money shot (refusals visible).
    for d in decisions:
        card = state.cards.get(d.source_id, {})
        emit("decision", {
            "taskId": state.task_id,
            "sourceId": d.source_id,
            "title": card.get("title", d.source_id),
            "creator": card.get("creator", {}).get("name", ""),
            "decision": d.decision,
            "reason": d.reason_code,
            "rationale": d.rationale,
            "voi": round(d.voi, 2),
            "relevance": round(d.relevance, 3),
            "novelty": round(d.novelty, 3),
            "expectedGain": round(d.expected_gain, 3),
            "price": d.price,
        })
        # Persist decision to the ledger immediately.
        client.record_decision({
            "taskId": state.task_id, "sourceId": d.source_id,
            "creatorId": d.creator_id, "decision": d.decision,
            "rationale": d.rationale, "relevance": d.relevance,
            "novelty": d.novelty, "expectedGain": d.expected_gain,
            "voi": d.voi, "price": d.price,
        })
    emit("assay_table", {"table": ranked_table(decisions)})
    return state


def node_pay(state: RunState, client: AssayClient, emit: EmitFn) -> RunState:
    for d in state.decisions:
        if d.decision != "BUY":
            continue
        card = state.cards.get(d.source_id, {})
        pay_to = card.get("creator", {}).get("walletAddress", "")
        emit("pay_start", {"sourceId": d.source_id, "price": d.price,
                           "payTo": pay_to, "title": card.get("title", d.source_id)})
        try:
            result = client.buy_content(d.source_id, d.price, pay_to,
                                        authorization_id=state.authorization_id)
        except Exception as e:  # noqa: BLE001 — surface, don't crash the run

            emit("pay_error", {"sourceId": d.source_id, "error": str(e)})
            continue
        state.bought_content[d.source_id] = result.get("content", "")
        payment = client.record_payment({
            "taskId": state.task_id, "sourceId": d.source_id,
            "creatorId": d.creator_id, "amount": d.price,
            "proof": result["proof"], "payer": result.get("payer", ""),
        })
        state.payments.append(payment)
        state.spent += d.price
        emit("pay_done", {"sourceId": d.source_id, "amount": d.price,
                          "proof": result["proof"], "creator": card.get("creator", {}).get("name", "")})
    return state


def node_synthesize(state: RunState, client: AssayClient, emit: EmitFn) -> RunState:
    bought = [d for d in state.decisions if d.decision == "BUY"]
    skipped = [d for d in state.decisions if d.decision == "SKIP"]
    cached = [d for d in state.decisions if d.decision == "CACHE"]
    creators_paid = sorted({state.cards.get(d.source_id, {}).get("creator", {}).get("name", "?")
                            for d in bought})

    lines: List[str] = [f"# Answer to: {state.prompt}", ""]
    if bought:
        lines.append("Synthesized from paid sources:")
        for d in bought:
            card = state.cards.get(d.source_id, {})
            snippet = (state.bought_content.get(d.source_id, "") or "").strip().replace("\n", " ")
            snippet = (snippet[:220] + "…") if len(snippet) > 220 else snippet
            lines.append(f"\n## {card.get('title', d.source_id)} "
                         f"— by {card.get('creator', {}).get('name', '?')} (${d.price:.4f})")
            lines.append(snippet or "(content retrieved)")
    else:
        lines.append("No sources cleared the value-of-information bar for this budget. "
                     "The agent refused to spend rather than buy low-value data.")

    cost_line = (f"\nThis answer cost ${state.spent:.4f}, paid to {len(creators_paid)} "
                 f"creator(s): {', '.join(creators_paid) if creators_paid else 'none'}. "
                 f"{len(skipped)} source(s) skipped, {len(cached)} served from cache.")
    lines.append(cost_line)
    state.answer = "\n".join(lines)

    emit("synthesize", {
        "answer": state.answer,
        "cost": round(state.spent, 6),
        "creatorsPaid": len(creators_paid),
        "bought": len(bought), "skipped": len(skipped), "cached": len(cached),
        "buySkipRatio": (len(bought) / len(skipped)) if skipped else float(len(bought)),
    })
    return state


# ---- Orchestration ------------------------------------------------------------------
NODES = [node_intake, node_discover, node_assay, node_pay, node_synthesize]
NODE_NAMES = ["intake", "discover", "assay", "pay", "synthesize"]


def build_graph(client: AssayClient, emit: EmitFn, state: RunState):
    """
    Compile a LangGraph over ONE shared, mutable RunState so the node topology is
    explicit and inspectable, while sidestepping LangGraph's per-channel state merging
    (which does NOT propagate our in-place dataclass mutations between nodes — that bug
    caused every task to arrive at ASSAY with an empty candidate list and spend $0).

    Each node wrapper mutates the shared `state` and returns no channel updates ({}),
    so control flow comes from the graph but the data lives in the single `state` object
    we hold a reference to. Falls back to a plain sequential runner if langgraph is absent.
    """
    try:
        from langgraph.graph import END, START, StateGraph

        g = StateGraph(RunState)

        def make_wrapper(fn):
            def _wrapped(_s):
                fn(state, client, emit)  # mutate the shared state in place
                return {}                # no channel updates — we hold the reference
            return _wrapped

        for name, fn in zip(NODE_NAMES, NODES):
            g.add_node(name, make_wrapper(fn))
        g.add_edge(START, "intake")
        for a, b in zip(NODE_NAMES, NODE_NAMES[1:]):
            g.add_edge(a, b)
        g.add_edge("synthesize", END)
        compiled = g.compile()

        class _LG:
            def invoke(self) -> RunState:
                compiled.invoke(state)  # drives topology; data flows via shared `state`
                return state

        return _LG()
    except Exception:
        # Fallback runner — identical semantics, no external dependency.
        class _Seq:
            def invoke(self) -> RunState:
                for fn in NODES:
                    fn(state, client, emit)
                return state
        return _Seq()


def run_task(prompt: str, budget: float, emit: EmitFn = _noop,
             config: Optional[AssayConfig] = None,
             backend_url: Optional[str] = None,
             authorization_id: Optional[str] = None) -> RunState:
    """Top-level entry: run one research task end-to-end. Returns the final state."""
    client = AssayClient(base_url=backend_url) if backend_url else AssayClient()
    state = RunState(prompt=prompt, budget=budget, config=config or AssayConfig(),
                     authorization_id=authorization_id)

    try:
        graph = build_graph(client, emit, state)
        return graph.invoke()
    finally:
        emit("done", {"taskId": state.task_id, "spent": round(state.spent, 6)})
        client.close()
