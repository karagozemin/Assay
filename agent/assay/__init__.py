"""Assay — the spending brain for research agents.

The decision engine (`engine`) and embedding (`embed`) are pure-stdlib and importable
in isolation — no network, no heavy deps — so the crown-jewel scoring logic can be unit
tested on its own. The orchestration layer (`graph`, `client`) pulls in httpx/langgraph
and is imported lazily on first access to keep `assay.engine` dependency-free.
"""
from importlib import import_module
from typing import TYPE_CHECKING

from .engine import (
    AssayConfig, Bought, Candidate, Decision, assay, ranked_table, score_candidate,
)

__all__ = [
    "AssayConfig", "Candidate", "Bought", "Decision",
    "assay", "ranked_table", "score_candidate",
    "RunState", "run_task",
]

# Lazily expose the orchestration layer so importing the engine never requires httpx.
_LAZY = {"RunState": "graph", "run_task": "graph"}


def __getattr__(name: str):  # PEP 562 module-level lazy attributes
    if name in _LAZY:
        mod = import_module(f".{_LAZY[name]}", __name__)
        return getattr(mod, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


if TYPE_CHECKING:  # for type-checkers / IDEs only, not executed at runtime
    from .graph import RunState, run_task  # noqa: F401
