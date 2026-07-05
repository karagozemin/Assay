"""
====================================================================================
ASSAY — the spending brain.  ***This file wins or loses the hackathon.***
====================================================================================

This is NOT `if price < budget: buy`. It treats a fixed budget as a PORTFOLIO problem:
estimate the marginal value-of-information (VoI) of each candidate source relative to
its price, then greedily buy the highest-VoI sources until a STOPPING RULE fires.

The scoring is deliberately simple, transparent, and swappable — a reviewer can read
`score_candidate` and `assay` top to bottom and understand exactly why each source was
bought or refused. Refusals are a first-class output, not an afterthought.

Per candidate:
    relevance     = cosine(embed(task), embed(candidate.abstract))            # topical fit
    novelty       = 1 - max(cosine(cand, b) for b in already_bought)          # overlap penalty
    expected_gain = relevance * novelty * quality_prior                        # marginal info
    voi           = expected_gain / price                                      # gain per dollar

Portfolio selection:
    Rank by VoI desc. Walk the ranked list; BUY while
        remaining_budget >= price  AND  marginal expected_gain >= STOP_THRESHOLD.
    Once expected_gain drops below STOP_THRESHOLD we STOP considering further buys
    (diminishing returns) — remaining candidates are refused with a stopping rationale.

Every candidate gets exactly one Decision with a written rationale:
    BUY            "VoI 0.42/$ — highest marginal gain, within budget"
    SKIP(overlap)  "novelty 0.11 — 89% redundant with source #<id> already bought"
    SKIP(price)    "gain 0.30 but $0.02 → VoI 15/$ below floor"
    SKIP(budget)   "would exceed remaining budget $0.003"
    SKIP(stopped)  "stopping rule fired — marginal gain 0.04 below threshold 0.08"
    CACHE          "identical source bought in task #<id> within TTL — reused free"

Because novelty is computed against BOTH already-purchased sources AND sources bought
earlier in this same portfolio pass, buying one source can turn a near-duplicate into a
refusal on the very next iteration. That cascade is the agency proof.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .embed import cosine, embed


# ---- Tunable policy (kept in one place so it is obvious and swappable) --------------
@dataclass(frozen=True)
class AssayConfig:
    # Marginal expected-gain floor. Once the best remaining candidate's expected_gain
    # falls below this, we stop buying (portfolio diminishing-returns stopping rule).
    stop_threshold: float = 0.08
    # A candidate whose novelty is below this is treated as redundant regardless of VoI.
    novelty_floor: float = 0.15
    # Minimum acceptable VoI (expected_gain per dollar). Filters overpriced sources.
    min_voi: float = 8.0
    # Cache TTL in seconds for identical prior purchases (task-to-task reuse).
    cache_ttl_seconds: int = 24 * 3600
    # A source we already own is only REUSED (CACHE) when it is genuinely on-topic for the
    # current task — its relevance must clear this floor. Owned-but-off-topic sources SKIP
    # instead of being falsely "reused", which keeps the ledger's CACHE rows honest.
    cache_relevance_floor: float = 0.22



DEFAULT_CONFIG = AssayConfig()


# ---- Inputs / outputs ---------------------------------------------------------------
@dataclass
class Candidate:
    """A discovered source card (metadata only — never the paid content)."""
    id: str
    creator_id: str
    title: str
    abstract: str
    price: float
    quality_prior: float
    embedding: List[float]
    creator_name: str = ""
    tags: List[str] = field(default_factory=list)


@dataclass
class Bought:
    """A source already paid for — either earlier in this run, or via the cache."""
    id: str
    embedding: List[float]
    task_id: Optional[str] = None
    bought_at: Optional[float] = None  # epoch seconds, for cache TTL


@dataclass
class Decision:
    source_id: str
    creator_id: str
    decision: str  # BUY | SKIP | CACHE
    rationale: str
    relevance: float
    novelty: float
    expected_gain: float
    voi: float
    price: float
    # Diagnostics for the transparent ranked table (README / UI money shot).
    reason_code: str = ""            # e.g. overlap, price, budget, stopped, cache, buy
    redundant_with: Optional[str] = None


# ---- Core scoring (pure, unit-testable) --------------------------------------------
def _novelty(
    cand_emb: List[float],
    bought: List[Bought],
    exclude_id: Optional[str] = None,
) -> tuple[float, Optional[str]]:
    """1 - max overlap with anything already bought. Returns (novelty, most_similar_id).

    `exclude_id` never lets a source be judged redundant with ITSELF (a source we already
    own is compared only against OTHER sources, never against its own embedding).
    """
    if not bought:
        return 1.0, None
    best_id, best_sim = None, -1.0
    for b in bought:
        if exclude_id is not None and b.id == exclude_id:
            continue
        sim = cosine(cand_emb, b.embedding)
        if sim > best_sim:
            best_sim, best_id = sim, b.id
    if best_id is None:  # only self was present
        return 1.0, None
    return max(0.0, 1.0 - best_sim), best_id


def score_candidate(
    cand: Candidate,
    task_embedding: List[float],
    bought: List[Bought],
) -> Dict[str, float]:
    """Compute relevance, novelty, expected_gain, voi for a single candidate."""
    relevance = cosine(task_embedding, cand.embedding)
    novelty, redundant_with = _novelty(cand.embedding, bought, exclude_id=cand.id)

    expected_gain = relevance * novelty * cand.quality_prior
    price = max(cand.price, 1e-9)  # guard divide-by-zero
    voi = expected_gain / price
    return {
        "relevance": relevance,
        "novelty": novelty,
        "expected_gain": expected_gain,
        "voi": voi,
        "redundant_with": redundant_with,  # type: ignore[dict-item]
    }


# ---- The portfolio decision --------------------------------------------------------
def assay(
    candidates: List[Candidate],
    task_prompt: str,
    budget: float,
    already_bought: Optional[List[Bought]] = None,
    cache_hits: Optional[Dict[str, Bought]] = None,
    config: AssayConfig = DEFAULT_CONFIG,
) -> List[Decision]:
    """
    Decide BUY / SKIP / CACHE for EVERY candidate under a fixed budget.

    `already_bought` : sources paid for in PRIOR tasks (seed novelty + cross-task context).
    `cache_hits`     : {source_id -> Bought} for identical sources purchased within TTL;
                       these are returned free as CACHE and still seed novelty.
    """
    already_bought = list(already_bought or [])
    cache_hits = cache_hits or {}

    task_emb = embed(task_prompt)

    # `bought_ctx` grows as we BUY within this pass — that is what turns later near-
    # duplicates into refusals. Seed it with prior purchases + cache hits.
    bought_ctx: List[Bought] = list(already_bought)
    for b in cache_hits.values():
        bought_ctx.append(b)

    # 1) Score everything against the CURRENT context (pre-purchase snapshot for the table).
    scored: List[tuple[Candidate, Dict[str, float]]] = []
    for c in candidates:
        scored.append((c, score_candidate(c, task_emb, bought_ctx)))

    # 2) Rank by VoI descending — the greedy portfolio order.
    scored.sort(key=lambda cs: cs[1]["voi"], reverse=True)

    decisions: List[Decision] = []
    remaining = budget
    stopped = False

    for cand, _ in scored:
        # 2a) Cache hit — a source we already OWN from a prior task. Reusing it is free, but
        # only counts as a CACHE HIT when the source would ACTUALLY be worth buying for THIS
        # task. We judge it on the same relevance bar as a fresh buy (novelty is excluded here
        # because owning the source is the whole point). An owned-but-off-topic source is a
        # normal SKIP, not a cache hit — otherwise every task falsely "reuses" the whole
        # registry once it has been bought at least once.
        if cand.id in cache_hits:
            hit = cache_hits[cand.id]
            s = score_candidate(cand, task_emb, bought_ctx)
            # relevance-only VoI: what this source would be worth to this task at its price.
            rel_gain = s["relevance"] * cand.quality_prior
            rel_voi = rel_gain / max(cand.price, 1e-9)
            if s["relevance"] >= config.cache_relevance_floor and rel_voi >= config.min_voi:

                decisions.append(Decision(
                    source_id=cand.id, creator_id=cand.creator_id, decision="CACHE",
                    rationale=(f"already own this from task #{hit.task_id} and it's relevant here "
                               f"(relevance {s['relevance']:.2f}) — reused free, saved ${cand.price:.4f}"),
                    relevance=s["relevance"], novelty=s["novelty"],
                    expected_gain=s["expected_gain"], voi=s["voi"], price=cand.price,
                    reason_code="cache",
                ))
            else:
                decisions.append(Decision(
                    source_id=cand.id, creator_id=cand.creator_id, decision="SKIP",
                    rationale=(f"own this from task #{hit.task_id} but off-topic here "
                               f"(relevance {s['relevance']:.2f}, VoI {rel_voi:.1f}/$) — not reused"),
                    relevance=s["relevance"], novelty=s["novelty"],
                    expected_gain=s["expected_gain"], voi=s["voi"], price=cand.price,
                    reason_code="cache_irrelevant",
                ))
            continue

        # 2b) Re-score against the LIVE context (includes sources bought earlier this pass).

        s = score_candidate(cand, task_emb, bought_ctx)
        relevance, novelty = s["relevance"], s["novelty"]
        expected_gain, voi = s["expected_gain"], s["voi"]
        redundant_with = s["redundant_with"]

        # 2c) Stopping-rule CASCADE — once we've decided to stop buying (in 2g below),
        # every lower-ranked candidate is a stopped-SKIP for consistency. This is the
        # cascade only; the *decision* to stop is made in 2g after specific-reason checks
        # so that a concrete reason (overlap / price / budget) is never masked by the
        # generic diminishing-returns message.
        if stopped:
            decisions.append(Decision(
                source_id=cand.id, creator_id=cand.creator_id, decision="SKIP",
                rationale=(f"stopping rule already fired upstream — marginal expected gain "
                           f"{expected_gain:.3f} at/under threshold {config.stop_threshold:.3f} "
                           f"(diminishing returns)"),
                relevance=relevance, novelty=novelty, expected_gain=expected_gain,
                voi=voi, price=cand.price, reason_code="stopped",
            ))
            continue

        # 2d) Redundancy refusal — the headline "it refused because it already knows this".
        # Checked FIRST among refusals: a near-duplicate's low novelty also depresses its
        # expected_gain, so overlap must win over the generic stopping message.
        if novelty < config.novelty_floor and redundant_with is not None:
            overlap_pct = round((1.0 - novelty) * 100)
            decisions.append(Decision(
                source_id=cand.id, creator_id=cand.creator_id, decision="SKIP",
                rationale=(f"novelty {novelty:.2f} — {overlap_pct}% redundant with source "
                           f"#{redundant_with} already bought"),
                relevance=relevance, novelty=novelty, expected_gain=expected_gain,
                voi=voi, price=cand.price, reason_code="overlap",
                redundant_with=redundant_with,
            ))
            continue

        # 2e) VoI floor refusal — has value but is overpriced for what it adds.
        if voi < config.min_voi:
            decisions.append(Decision(
                source_id=cand.id, creator_id=cand.creator_id, decision="SKIP",
                rationale=(f"gain {expected_gain:.2f} but price ${cand.price:.4f} → "
                           f"VoI {voi:.1f}/$ below floor {config.min_voi:.0f}/$"),
                relevance=relevance, novelty=novelty, expected_gain=expected_gain,
                voi=voi, price=cand.price, reason_code="price",
            ))
            continue

        # 2f) Budget refusal — worth it, but no room left. Precedes the stopping DECISION
        # so an affordable-but-unfunded source is reported as a budget constraint.
        if cand.price > remaining:
            decisions.append(Decision(
                source_id=cand.id, creator_id=cand.creator_id, decision="SKIP",
                rationale=(f"VoI {voi:.1f}/$ clears the bar but price ${cand.price:.4f} "
                           f"would exceed remaining budget ${remaining:.4f}"),
                relevance=relevance, novelty=novelty, expected_gain=expected_gain,
                voi=voi, price=cand.price, reason_code="budget",
            ))
            continue

        # 2f2) Stopping-rule DECISION — diminishing returns. The candidate is novel enough,
        # priced fairly, and affordable, yet its marginal gain no longer justifies a buy.
        # We stop here and cascade to all lower-ranked candidates via the `stopped` flag.
        if expected_gain < config.stop_threshold:
            stopped = True
            decisions.append(Decision(
                source_id=cand.id, creator_id=cand.creator_id, decision="SKIP",
                rationale=(f"stopping rule fired — marginal expected gain {expected_gain:.3f} "
                           f"below threshold {config.stop_threshold:.3f} (diminishing returns)"),
                relevance=relevance, novelty=novelty, expected_gain=expected_gain,
                voi=voi, price=cand.price, reason_code="stopped",
            ))
            continue

        # 2g) BUY — clears novelty, VoI, budget, and stopping rule.

        remaining -= cand.price
        bought_ctx.append(Bought(id=cand.id, embedding=cand.embedding))
        decisions.append(Decision(
            source_id=cand.id, creator_id=cand.creator_id, decision="BUY",
            rationale=(f"BUY — VoI {voi:.1f}/$ (gain {expected_gain:.2f} @ ${cand.price:.4f}); "
                       f"novelty {novelty:.2f}, relevance {relevance:.2f}; "
                       f"${remaining:.4f} budget left"),
            relevance=relevance, novelty=novelty, expected_gain=expected_gain,
            voi=voi, price=cand.price, reason_code="buy",
        ))

    return decisions


def ranked_table(decisions: List[Decision]) -> List[dict]:
    """Flatten decisions into the transparent ranked table shown in the UI/README."""
    return [
        {
            "sourceId": d.source_id,
            "decision": d.decision,
            "voi": round(d.voi, 2),
            "relevance": round(d.relevance, 3),
            "novelty": round(d.novelty, 3),
            "expectedGain": round(d.expected_gain, 3),
            "price": d.price,
            "reason": d.reason_code,
            "rationale": d.rationale,
        }
        for d in decisions
    ]
