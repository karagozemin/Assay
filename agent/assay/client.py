"""
Backend + payment client for the Assay agent.

Talks to the TypeScript backend (registry + ledger) and executes the x402 payment
flow against a source's protected /content endpoint.

Payment path:
  1. GET /content/:sourceId  → 402 Payment Required (price + payTo creator wallet)
  2. Pay via Circle Gateway nanopayment on Arc testnet (real testnet USDC).
  3. Retry with the X-PAYMENT header → 200 + content + settlement proof.

`ASSAY_MOCK_PAY=1` swaps step 2 for a deterministic fake settlement id. This flag is a
DEV-ONLY convenience (BUILD ORDER step 3 offline runs); the final demo path pays for real.
"""
from __future__ import annotations

import os
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx

BACKEND_URL = os.environ.get("ASSAY_BACKEND_URL", "http://localhost:4000")
MOCK_PAY = os.environ.get("ASSAY_MOCK_PAY", "0") == "1"
AGENT_WALLET = os.environ.get("ASSAY_AGENT_WALLET", "0xAGENT0000000000000000000000000000000000")
ARC_NETWORK = "eip155:5042002"


class AssayClient:
    def __init__(self, base_url: str = BACKEND_URL, timeout: float = 20.0):
        self.base = base_url.rstrip("/")
        self.http = httpx.Client(timeout=timeout)

    # ---- Registry -------------------------------------------------------------------
    def discover(self, query: str = "") -> List[Dict[str, Any]]:
        r = self.http.get(f"{self.base}/discover", params={"q": query} if query else None)
        r.raise_for_status()
        return r.json()

    def create_task(self, prompt: str, budget: float) -> Dict[str, Any]:
        r = self.http.post(f"{self.base}/tasks", json={"prompt": prompt, "budget": budget})
        r.raise_for_status()
        return r.json()

    def prior_purchases(self, task_id: str) -> List[Dict[str, Any]]:
        """Payments made in earlier tasks — used to seed cross-task novelty + cache."""
        try:
            r = self.http.get(f"{self.base}/ledger/payments")
            r.raise_for_status()
            return [p for p in r.json() if p.get("taskId") != task_id]
        except httpx.HTTPError:
            return []

    # ---- Ledger ---------------------------------------------------------------------
    def record_decision(self, payload: Dict[str, Any]) -> None:
        self.http.post(f"{self.base}/ledger/decisions", json=payload)

    def record_payment(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        r = self.http.post(f"{self.base}/ledger/payments", json=payload)
        r.raise_for_status()
        return r.json()

    # ---- x402 payment flow ----------------------------------------------------------
    def buy_content(self, source_id: str, price: float, pay_to: str,
                    authorization_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Execute the x402 flow for one source. Returns {content, proof, payer, network}.
        Raises on unrecoverable payment failure.

        Real path: POST /pay/settle. The Circle Gateway batching SDK is Node-only, so the
        backend owns the agent's paying wallet and runs the full flow server-side
        (GET /content → 402 → Gateway nanopayment on Arc testnet → retry), returning the
        paid content plus the on-chain settlement proof. We just consume the result.

        `authorization_id` carries the buyer's signed spending mandate; the backend
        enforces the signed cap against it before any money moves, and rejects the
        settle with 401/403 if it's missing or exceeded.
        """
        if MOCK_PAY:
            # DEV-ONLY: deterministic fake settlement so offline runs don't touch chain.
            proof = f"0xmock{uuid.uuid4().hex[:32]}"
            preview = self._peek_content(source_id)
            return {"content": preview, "proof": proof, "payer": AGENT_WALLET,
                    "network": ARC_NETWORK}

        payload: Dict[str, Any] = {"sourceId": source_id}
        if authorization_id:
            payload["authorizationId"] = authorization_id
        r = self.http.post(f"{self.base}/pay/settle", json=payload)
        r.raise_for_status()

        data = r.json()
        pay = data.get("payment", {})
        proof = pay.get("settlementId")
        if not proof:
            raise RuntimeError(f"settle for source {source_id} returned no settlementId")
        return {
            "content": data.get("content", ""),
            "proof": proof,
            "payer": pay.get("payer", AGENT_WALLET),
            "network": pay.get("network", ARC_NETWORK),
        }

    def _peek_content(self, source_id: str) -> str:
        """MOCK-only: read the source card so mock runs still synthesize real text."""
        try:
            for c in self.discover():
                if c.get("id") == source_id:
                    return c.get("abstract", "")
        except httpx.HTTPError:
            pass
        return ""


    def close(self) -> None:
        self.http.close()
