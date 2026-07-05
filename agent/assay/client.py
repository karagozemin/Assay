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
    def buy_content(self, source_id: str, price: float, pay_to: str) -> Dict[str, Any]:
        """
        Execute the x402 flow for one source. Returns {content, proof, payer, network}.
        Raises on unrecoverable payment failure.
        """
        url = f"{self.base}/content/{source_id}"
        first = self.http.get(url)
        if first.status_code == 200:
            # Some sellers may serve free (price 0) — treat as a zero-cost settlement.
            return {"content": first.text, "proof": "free", "payer": AGENT_WALLET,
                    "network": ARC_NETWORK}
        if first.status_code != 402:
            first.raise_for_status()

        # We got a 402 — settle the nanopayment, then retry.
        settlement = self._settle(source_id, price, pay_to, first)
        paid = self.http.get(url, headers={"X-PAYMENT": settlement["header"]})
        if paid.status_code != 200:
            # Fall back to the settlement proof even if content fetch is flaky, so the
            # ledger still records that money moved. Content will be empty.
            paid_text = ""
        else:
            paid_text = paid.text
        return {
            "content": paid_text,
            "proof": settlement["proof"],
            "payer": settlement["payer"],
            "network": ARC_NETWORK,
        }

    def _settle(self, source_id: str, price: float, pay_to: str,
                challenge: httpx.Response) -> Dict[str, str]:
        if MOCK_PAY:
            proof = f"0xmock{uuid.uuid4().hex[:32]}"
            return {"proof": proof, "payer": AGENT_WALLET,
                    "header": f"mock:{proof}"}
        # Real path: hand the 402 challenge to the Circle Gateway nanopayment settler.
        # The batching SDK lives on the Node side; here we call the backend's settle
        # helper which uses the agent's Circle wallet to authorize the transfer.
        r = self.http.post(f"{self.base}/pay/settle", json={
            "sourceId": source_id,
            "price": price,
            "payTo": pay_to,
            "payer": AGENT_WALLET,
            "challenge": dict(challenge.headers),
        })
        r.raise_for_status()
        data = r.json()
        return {"proof": data["proof"], "payer": data.get("payer", AGENT_WALLET),
                "header": data["header"]}

    def close(self) -> None:
        self.http.close()
