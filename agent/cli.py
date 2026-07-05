"""
Assay CLI — run a research task from the terminal and watch the spending brain decide.

    python -m cli run "How do nanopayments settle on Arc?" --budget 0.02
    ASSAY_MOCK_PAY=1 python -m cli run "..." --budget 0.02      # offline dev

Prints the live decision feed (BUY / SKIP / CACHE with rationales), the ranked ASSAY
table, and the final cost breakdown — the same reasoning the web UI surfaces.
"""
from __future__ import annotations

from typing import Any, Dict

import typer
from rich.console import Console
from rich.table import Table

from assay.graph import run_task

app = typer.Typer(add_completion=False, help="Assay — the spending brain for research agents.")
console = Console()

_COLOR = {"BUY": "bold green", "SKIP": "yellow", "CACHE": "cyan"}


def _make_emit():
    def emit(event: str, data: Dict[str, Any]) -> None:
        if event == "intake":
            console.rule(f"[bold]Task[/bold] {data['prompt']}  (budget ${data['budget']:.4f})")
        elif event == "discover":
            console.print(f"[dim]DISCOVER → {data['count']} candidate sources "
                          f"({data['priorPurchases']} prior purchases seed novelty)[/dim]")
        elif event == "decision":
            color = _COLOR.get(data["decision"], "white")
            console.print(f"[{color}]{data['decision']:5}[/{color}] "
                          f"[bold]{data['title']}[/bold]  "
                          f"[dim](VoI {data['voi']}/$ · rel {data['relevance']} · nov {data['novelty']})[/dim]\n"
                          f"       ↳ {data['rationale']}")
        elif event == "pay_start":
            console.print(f"[green]  PAY[/green] {data['title']} → {data['payTo'][:10]}… "
                          f"${data['price']:.4f}")
        elif event == "pay_done":
            console.print(f"[bold green]  ✓ PAID[/bold green] {data['creator']} "
                          f"${data['amount']:.4f}  proof={data['proof'][:18]}…")
        elif event == "pay_error":
            console.print(f"[bold red]  ✗ PAY FAILED[/bold red] {data['sourceId']}: {data['error']}")
        elif event == "synthesize":
            console.rule("[bold]Answer[/bold]")
            console.print(data["answer"])
            console.print(f"\n[bold]Cost:[/bold] ${data['cost']:.4f} · "
                          f"bought {data['bought']} · skipped {data['skipped']} · "
                          f"cached {data['cached']} · buy/skip {data['buySkipRatio']:.2f}")
    return emit


@app.command()
def run(
    prompt: str = typer.Argument(..., help="The research question."),
    budget: float = typer.Option(0.02, "--budget", "-b", help="Budget in testnet USDC."),
    backend: str = typer.Option(None, "--backend", help="Backend URL override."),
):
    """Run one research task end-to-end."""
    run_task(prompt, budget, emit=_make_emit(), backend_url=backend)


if __name__ == "__main__":
    app()
