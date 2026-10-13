<p align="center">
  <img src="assay.png" alt="Assay logo" width="160" style="border-radius: 24px;" />
</p>

# Assay — the spending brain for research agents

Assay ranks paid research sources by marginal value-of-information (VoI), buys only
what clears a budget-aware threshold, and records why it refused everything else. The
repository includes an Arc testnet x402 integration and a provenance-aware demo path.

Live frontend: <https://assay-web.vercel.app/app>

## Proof boundary

Assay currently distinguishes these payment-stage records:

| Provenance | Meaning |
| --- | --- |
| `demo_test_settlement` | Local/demo event. Not USDC settlement. |
| `arc_testnet_x402` | Arc testnet x402 result with a settlement identifier. |
| `payment_intent` | A payment-stage intent without verified settlement. |
| `arc_mainnet_receipt_anchor` | Reserved for the next receipt-anchor stage; not implemented yet. |

`test-settle-*` and `0xmock*` identifiers are always classified as
`demo_test_settlement`. They are visible in the ledger, but excluded from the dashboard's
“testnet USDC settled” totals and never described as creator payouts.

This repository does **not yet contain an Arc mainnet receipt anchor or real Arc
mainnet creator-payment settlement**. The mainnet environment values required in
production are a fail-closed boundary for the next receipt-anchor patch. Configuring an
RPC URL is not evidence of a mainnet transaction.

## What the prototype demonstrates

- An EIP-712 spending authorization and server-enforced cap.
- A deterministic VoI engine that emits one `BUY`, `SKIP`, or `CACHE` decision and a
  rationale for every candidate.
- A Python/LangGraph agent with a streamed SSE run feed.
- A TypeScript registry, decision ledger, payment-stage ledger, and aggregate views.
- An Arc testnet x402/Circle Gateway integration when a funded testnet paymaster is
  manually configured.
- Explicit separation of demo events, payment intents, and testnet settlement records.

The seeded dataset contains five demo creator records and eleven deliberately
overlapping sources. It exists to exercise refusal, redundancy, budget, cache, and
stopping-rule behavior; it is not evidence of real creator revenue.

## Decision policy

For each candidate, Assay computes:

```text
relevance     = cosine(embed(task), embed(candidate.abstract))
novelty       = 1 - max(cosine(candidate, previously_bought_source))
expected_gain = relevance * novelty * quality_prior
voi           = expected_gain / price
```

The agent ranks candidates by VoI and buys while the remaining budget covers the price
and marginal gain clears the stopping threshold. Novelty is recomputed after each buy,
so near-duplicates can become refusals during the same run. The engine is intentionally
small and covered by tests in `agent/tests/`.

## Repository map

```text
agent/                 Python agent and FastAPI SSE service
  assay/engine.py      Pure VoI portfolio decision engine
  assay/graph.py       INTAKE → DISCOVER → ASSAY → PAY → SYNTHESIZE
  api.py               Public agent service; backend URL comes from env only

backend/               Node/TypeScript service
  src/server.ts        Registry, authorization, x402, ledger, metrics, health
  src/config.ts        Production fail-closed configuration
  src/arc.ts           Arc testnet constants and wallet-control verification
  src/db.ts            SQLite store and provenance migration

web/                   Next.js demo UI
  app/app/             Run, creator, and dashboard screens
  config/              Production public-URL validation

render.yaml            Render Blueprint for backend + agent
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the detailed system diagrams.

## Run locally

Prerequisites: Node 22+, Python 3.11+.

```bash
make install

# Three terminals:
make backend
make seed
make web
```

The local demo can use `ASSAY_MOCK_PAY=1`; that mode produces visibly labelled
demo/test events. A funded testnet wallet is required for the Arc testnet x402 path.
Never commit a private key or expose one through a `NEXT_PUBLIC_*` value.

Useful checks:

```bash
cd backend && npm run typecheck && npm test
./agent/.venv/bin/python agent/run_tests.py
cd web && npm test
```

## Render deployment

The root [`render.yaml`](render.yaml) defines two stable-origin services:

| Service | Root | Build | Start |
| --- | --- | --- | --- |
| `assay-backend` | `backend` | `npm ci && npm run build` | `npm start` |
| `assay-agent` | `agent` | `pip install -r requirements.txt` | `uvicorn api:app --host 0.0.0.0 --port $PORT` |

Both expose `GET /health`. The backend binds to `0.0.0.0:$PORT`. The Blueprint also
attaches a persistent disk at `/var/data` and uses
`ASSAY_DB=/var/data/assay.sqlite`; without a persistent disk, SQLite state disappears
on redeploy. Render persistent disks require a paid service instance; the current
SQLite build is therefore not durable on Render Free.

After the first backend deploy, open its Render Shell and run `npm run seed` once. The
idempotent command loads clearly marked demo fixtures: 5 demo creators, 11 sources, 11
decisions, and 3 `demo_test_settlement` events. It does not broadcast a transaction and
does not require a wallet key.

### Backend environment

```dotenv
NODE_ENV=production
ASSAY_RUNTIME=production
ASSAY_DB=/var/data/assay.sqlite
ASSAY_TEST_SETTLE=0
ASSAY_MOCK_PAY=0
CORS_ORIGIN=https://assay-web.vercel.app
ARC_MAINNET_CHAIN_ID=5042
ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io
ARC_MAINNET_EXPLORER_URL=https://explorer.arc.io
```

Do not set `PORT`; Render provides it. Production startup fails if either test/mock flag
is `1`, if CORS uses `*`, or if the Arc mainnet boundary is missing or has a chain ID
other than `5042`.

The hosted non-settling prototype needs no payment secret. If the Arc testnet x402 path
is enabled later, provide its funded testnet wallet values manually as secret backend
environment variables. Never put them in `render.yaml`, Vercel, browser code, logs, or
documentation.

Without a funded testnet paymaster, a live run fails the purchase closed, does not return
protected content, does not increment spend, and records an uncharged `payment_intent`
for the UI. The seeded `demo_test_settlement` rows remain separate from these intents.

### Agent environment

```dotenv
ASSAY_RUNTIME=production
ASSAY_BACKEND_URL=https://assay-backend.onrender.com
CORS_ORIGIN=https://assay-web.vercel.app
ASSAY_TEST_SETTLE=0
ASSAY_MOCK_PAY=0
```

The production agent refuses localhost, loopback, and `*.trycloudflare.com` backend
URLs. Public `/run` callers cannot override the backend URL.

### Vercel environment

Set these values for the Production environment, then redeploy:

```dotenv
NEXT_PUBLIC_BACKEND_URL=https://assay-backend.onrender.com
NEXT_PUBLIC_AGENT_URL=https://assay-agent.onrender.com
```

The Next.js production build fails if either URL is missing or points to localhost,
loopback, or `*.trycloudflare.com`. These are public service origins, not secrets.

### Verify after deployment

```bash
curl --fail https://assay-backend.onrender.com/health
curl --fail https://assay-agent.onrender.com/health
```

Then redeploy Vercel and open <https://assay-web.vercel.app/app>. Payment-stage events
must be labelled by provenance. A demo/test record must never appear as settled USDC.

## Remaining mainnet step

Before an Arc Microgrants submission claims an Arc mainnet component, implement and
broadcast the separately scoped user-signed run-receipt anchor, persist its canonical
receipt and transaction proof, and expose an Arc explorer link. That anchor proves the
run receipt and decision ledger; it does not prove creator-payment settlement.

Assay should not be described as an Arc mainnet working prototype until such a real,
verifiable mainnet transaction is stored and displayed.
