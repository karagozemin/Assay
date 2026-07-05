"""
Tests for the ASSAY decision engine — the agency proof.

These assert the engine is NOT `if price < budget: buy`. We prove it emits:
  * a BUY for the best VoI candidate,
  * an overlap SKIP (redundancy refusal) for a near-duplicate,
  * a price SKIP for an overpriced source,
  * a budget SKIP when funds run out,
  * a CACHE hit for an identical prior purchase,
  * a stopping-rule SKIP for diminishing returns,
and that EVERY candidate receives exactly one decision.
"""
from __future__ import annotations

from assay.embed import embed
from assay.engine import AssayConfig, Bought, Candidate, assay


def _cand(cid, text, price, quality=0.9, creator="c1"):
    return Candidate(id=cid, creator_id=creator, title=cid, abstract=text,
                     price=price, quality_prior=quality, embedding=embed(text))


TASK = "how do stablecoin nanopayments settle on the arc testnet using usdc"


def _by_id(decisions):
    return {d.source_id: d for d in decisions}


def test_every_candidate_gets_exactly_one_decision():
    cands = [
        _cand("s1", "stablecoin nanopayments settle on arc testnet with usdc", 0.002),
        _cand("s2", "gardening tips for tomatoes in summer", 0.002),
        _cand("s3", "arc testnet usdc nanopayment settlement gateway batching", 0.002),
    ]
    decisions = assay(cands, TASK, budget=1.0)
    assert len(decisions) == len(cands)
    assert set(_by_id(decisions).keys()) == {"s1", "s2", "s3"}
    for d in decisions:
        assert d.decision in {"BUY", "SKIP", "CACHE"}
        assert d.rationale  # every decision is justified


def test_redundancy_produces_refusal():
    # s1 and s1dup are near-identical; the second should be refused for low novelty.
    text = "stablecoin nanopayments settle on arc testnet with usdc gateway"
    cands = [
        _cand("s1", text, 0.002),
        _cand("s1dup", text + " and more", 0.002),
    ]
    decisions = _by_id(assay(cands, TASK, budget=1.0))
    kinds = {decisions["s1"].decision, decisions["s1dup"].decision}
    assert "BUY" in kinds
    dup = decisions["s1dup"] if decisions["s1dup"].decision == "SKIP" else decisions["s1"]
    assert dup.decision == "SKIP"
    assert dup.reason_code == "overlap"
    assert dup.redundant_with is not None


def test_overpriced_source_is_skipped_on_voi():
    cfg = AssayConfig(min_voi=50.0)
    cands = [
        _cand("cheap", "arc testnet usdc nanopayment settlement", 0.001),
        _cand("pricey", "arc testnet usdc nanopayment gateway batching flow", 2.0),
    ]
    decisions = _by_id(assay(cands, TASK, budget=10.0, config=cfg))
    assert decisions["pricey"].decision == "SKIP"
    assert decisions["pricey"].reason_code in {"price", "stopped"}


def test_budget_exhaustion_produces_budget_skip():
    # Two strong, distinct sources but only enough budget for one.
    cands = [
        _cand("a", "arc testnet usdc nanopayment settlement gateway", 0.01),
        _cand("b", "circle gateway batching sub-cent stablecoin transfers ethereum", 0.01),
    ]
    decisions = assay(cands, TASK, budget=0.01, config=AssayConfig(min_voi=0.0, novelty_floor=0.0))
    kinds = [d.decision for d in decisions]
    assert kinds.count("BUY") == 1
    skips = [d for d in decisions if d.decision == "SKIP"]
    assert any(d.reason_code == "budget" for d in skips)


def test_cache_hit_is_free_and_recorded():
    text = "arc testnet usdc nanopayment settlement gateway"
    c = _cand("s1", text, 0.002)
    prior = Bought(id="s1", embedding=c.embedding, task_id="task-earlier")
    decisions = _by_id(assay([c], TASK, budget=1.0, cache_hits={"s1": prior}))
    assert decisions["s1"].decision == "CACHE"
    assert "task-earlier" in decisions["s1"].rationale


def test_stopping_rule_fires_on_diminishing_returns():
    cfg = AssayConfig(stop_threshold=0.5, min_voi=0.0, novelty_floor=0.0)
    cands = [
        _cand("strong", "arc testnet usdc nanopayment settlement gateway usdc arc", 0.001, quality=1.0),
        _cand("weak", "unrelated cooking recipe pasta", 0.001, quality=0.1),
    ]
    decisions = _by_id(assay(cands, TASK, budget=1.0, config=cfg))
    assert decisions["weak"].decision == "SKIP"
    assert decisions["weak"].reason_code == "stopped"
