from assay.engine import Decision
from assay.graph import RunState, node_pay


class _Unavailable(Exception):
    response = type("Response", (), {"status_code": 503})()


class _Client:
    def buy_content(self, *_args, **_kwargs):
        raise _Unavailable("paymaster unavailable")

    def record_payment(self, payload):
        return {"id": "intent-1", **payload}


def test_unconfigured_paymaster_records_uncharged_intent():
    state = RunState(prompt="test", budget=0.01, task_id="task-1")
    state.cards["source-1"] = {
        "title": "Demo source",
        "creator": {"name": "[Demo] Creator", "walletAddress": "0x0"},
    }
    state.decisions = [
        Decision(
            source_id="source-1",
            creator_id="creator-1",
            decision="BUY",
            rationale="test",
            relevance=1,
            novelty=1,
            expected_gain=1,
            voi=100,
            price=0.002,
        )
    ]
    events = []

    node_pay(state, _Client(), lambda name, data: events.append((name, data)))

    assert state.spent == 0
    assert len(state.payments) == 1
    assert state.payments[0]["provenance"] == "payment_intent"
    assert any(name == "pay_intent" for name, _data in events)
    assert not any(name == "pay_done" for name, _data in events)
