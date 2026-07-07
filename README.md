<p align="center">
  <img src="assay.png" alt="Assay logo" width="160" style="border-radius: 24px;" />
</p>

# Assay — the spending brain for research agents

> **Assay decides which creator sources are worth buying, then pays them per use over x402 on Arc.**

Given a research question and a fixed USDC budget, Assay estimates the marginal
**value-of-information (VoI)** of every candidate source, allocates the budget as a
**portfolio problem**, and pays creators per use via **x402 + Circle Gateway
nanopayments** on the **Arc testnet**. Every decision — *especially the refusals* — is
logged with a machine-readable rationale in a live payout ledger.

The differentiator is **judgment**: this is **not** `if price < budget: buy`. Assay can
justify why it did *not* buy a source. Refusals are the feature.

---

## 📊 Live traction (last clean batch — 14 tasks, 11 sources, 5 creators)

| Metric | Value |
| --- | ---: |
| Creators onboarded | **5** |
| Sources registered | **11** |
| Unique tasks run | **14** |
| Repeat tasks | **2** |
| Paid x402 calls | **10** |
| Total USDC settled (testnet) | **$0.0241** |
| Avg payment size | **$0.00241** |
| Unique creators paid | **5** |
| **BUY** decisions | **10** |
| **SKIP** decisions (refusals) | **114** |
| **CACHE** hits (free reuse) | **30** |
| Buy/Skip ratio | **0.088** |

All payments settled on **Arc testnet** (`eip155:5042002`) from a single agent payer
wallet (`0x1a05…5611`); each `BUY` row carries an x402 settlement `proof` in the ledger.

**Per-creator payouts**

| Creator | Earned | Paid calls |
| --- | ---: | ---: |
| Katherine Johnson | $0.0060 | 2 |
| Ada Lovelace | $0.0050 | 2 |
| Alan Turing | $0.0049 | 3 |
| Grace Hopper | $0.0047 | 2 |
| Claude Shannon | $0.0035 | 1 |

> The agency proof is in the ratios: **114 refusals and 30 cache-hits against just 10
> buys** (buy/skip 0.088). Refusals break down into overlap, VoI-floor, budget, and
> diminishing-returns *stopping-rule* rationales — every one logged. Repeat tasks
> (identical prompts) spent **$0.00**: the agent recognized it already owned the relevant
> sources and reused them free. Owned-but-off-topic sources are logged as honest **SKIP**s,
> not false cache-hits — a source only counts as a `CACHE` reuse when it clears the same
> relevance bar a fresh buy would.


---

## Why this wins on agency (read `agent/assay/engine.py`)

For each candidate source Assay computes:

```
relevance     = cosine(embed(task), embed(candidate.abstract))      # topical fit
novelty       = 1 - max(cosine(candidate, b) for b in already_bought)  # overlap penalty
expected_gain = relevance * novelty * quality_prior                  # marginal info
voi           = expected_gain / price                                # gain per dollar
```

It ranks by VoI and greedily buys **while** `remaining_budget >= price` **and**
`marginal expected_gain >= STOP_THRESHOLD`. Because `novelty` is recomputed against
sources bought **earlier in the same pass**, buying one source can turn the next
near-duplicate into a refusal — that cascade is the judgment.

Every candidate emits exactly one `Decision` with a written rationale:

| Decision | Example rationale |
| --- | --- |
| `BUY` | `VoI 0.42/$ — highest marginal gain, within budget` |
| `SKIP` (overlap) | `novelty 0.11 — 89% redundant with source #<id> already bought` |
| `SKIP` (price) | `gain 0.30 but $0.02 → VoI 15/$ below floor` |
| `SKIP` (budget) | `would exceed remaining budget $0.003` |
| `SKIP` (stopped) | `stopping rule fired — marginal gain 0.04 below threshold 0.08` |
| `CACHE` | `identical source purchased in task #<id> within TTL — reused free` |

The scoring policy lives in one small, swappable `AssayConfig` and the whole engine is
pure and unit-tested (`agent/tests/test_engine.py`) so reviewers can read it top to
bottom.

---

## Architecture

**📐 Full architecture — with diagrams — lives in [`ARCHITECTURE.md`](ARCHITECTURE.md).**
It maps the whole system: the big picture, the VoI decision ladder, the run state machine,
the x402 money path, and the trust model — each as a short paragraph + a diagram.

At a glance, a monorepo with three parts around one SQLite ledger:


```
agent/          Python + LangGraph spending brain
  assay/engine.py    ← the VoI portfolio decision engine (the crown jewel)
  assay/graph.py     ← INTAKE → DISCOVER → ASSAY → PAY → SYNTHESIZE → LEDGER-WRITE
  cli.py / api.py    ← run a task from the CLI or stream it over the API

backend/        Node/TypeScript registry + ledger + payout
  src/server.ts      ← registry, x402 seller middleware, ledger, dashboard endpoints
  src/x402.ts        ← 402 Payment Required flow + payment verification
  src/arc.ts         ← Arc testnet / Circle Gateway nanopayment settlement

web/            Next.js + Tailwind demo surface
  app/page.tsx       ← AGENT RUN (streams ASSAY decisions live; refusals up front)
  app/creator/       ← CREATOR onboarding + live earnings
  app/dashboard/     ← LEDGER + traction metrics

payments-poc/   step-1 proof: one real testnet USDC nanopayment over x402 on Arc
scripts/        seed.py (creators + sources + demo task batch), smoke_run.py
```

### The agent state machine (`agent/assay/graph.py`)
- **INTAKE** — parse task, set budget & quality target.
- **DISCOVER** — query the Source Registry for candidate cards (metadata + price +
  creator, never the paid content).
- **ASSAY** — the VoI portfolio decision above; emits BUY/SKIP/CACHE for *every* candidate.
- **PAY** — for each BUY, hit the source's protected endpoint; on HTTP 402 pay via
  Gateway nanopayment, retry, receive content, record the proof.
- **SYNTHESIZE** — answer with inline attribution + a cost breakdown
  (`this answer cost $0.0097, paid 4 creators; N sources skipped`).
- **LEDGER-WRITE** — persist every decision + payment to the backend.

---

## Circle / Arc stack

- **Arc testnet** (Canteen-hosted RPC) for settlement.
- **Circle CLI + wallets** — every agent *and* every creator has a Circle wallet.
- **Circle Gateway Nanopayments** — the sub-cent, gas-free, batched payment path
  (prices in the $0.0001–$0.01 range).
- **x402 protocol** — the 402-Payment-Required flow on every source content endpoint.

Payment plumbing was adapted from `circlefin/arc-nanopayments` (LangChain paying agent +
x402 seller endpoints + Gateway batching) rather than reinvented.

---

## Run it locally

**Prereqs:** Node ≥ v20.18.2, Python 3.11+, the `.venv` in this repo.

There's a `Makefile` for one-command ergonomics — run `make help` to list every target.

```bash
make install            # deps for backend, web, and the agent

# in three terminals:
make backend            # registry + x402 + ledger  → http://localhost:4000
make seed               # 5 creators + 11 sources + the demo task batch (mock-pay flag)
make web                # Next.js demo surface       → http://localhost:3000
```

Prefer raw commands? They're equivalent:

```bash
cd backend && npm install && npm run start
ASSAY_MOCK_PAY=1 ./.venv/bin/python scripts/seed.py --run   # drop the flag for real Arc settlement
cd web && npm install && npm run dev
```

### Verify the decision engine (no pytest required)
```bash
make test        # or: ./.venv/bin/python agent/run_tests.py
# → 6 passed, 0 failed — covers refusals, budget/price skips, cache-hits, stopping rule
```


Then open:
- **`/`** — AGENT RUN: enter a task + budget, watch ASSAY stream BUY/SKIP/CACHE live.
- **`/creator`** — register a source, connect a wallet, see live earnings.
- **`/dashboard`** — the live payout ledger + traction metrics above.

### Run a single task from the CLI
```bash
./.venv/bin/python agent/cli.py "How do nanopayments settle on Arc?" --budget 0.01
```

### Backend API surface
```
POST /creators                register a creator (name, walletAddress)
POST /sources                 register a source (title, abstract, content, price, tags)
GET  /discover?q=...          candidate cards (metadata only — never content)
GET  /content/:sourceId       x402-protected: 402 when unpaid, content when paid
POST /ledger/decisions        append a BUY/SKIP/CACHE decision + rationale
POST /ledger/payments         append a settled payment + proof
GET  /payouts                 per-creator aggregate earnings
GET  /metrics                 traction metrics (paid calls, USDC settled, ratios, ...)
```

---

## Anti-patterns we deliberately avoided
- No unconditional buying — **refusals are surfaced, not hidden**.
- No mocked payments in the final path — mocks live behind `ASSAY_MOCK_PAY` for dev only.
- No "detect reuse across the open web" claims — out of scope.
- Not a generic wallet/SDK dashboard — this is an *application*.

---

*Assay — the spending brain for research agents. It decides which creator sources are
worth buying, then pays them per use over x402 on Arc.*
