<p align="center">
  <img src="assay.png" alt="Assay logo" width="160" style="border-radius: 24px;" />
</p>

# Assay — the spending brain for research agents

Assay ranks paid research sources by marginal value-of-information (VoI), buys only
what clears a budget-aware threshold, and records why it refused everything else. The
repository includes an Arc testnet x402 integration, a provenance-aware demo path, and
a user-signed Arc mainnet run-receipt anchor.

Live frontend: <https://www.assay-web.site/app>

## Proof boundary

Assay distinguishes these provenance and proof records:

| Provenance | Meaning |
| --- | --- |
| `demo_test_settlement` | Local/demo event. Not USDC settlement. |
| `arc_testnet_x402` | Arc testnet x402 result with a settlement identifier. |
| `payment_intent` | A payment-stage intent without verified settlement. |
| `arc_mainnet_receipt_anchor` | A verified Arc mainnet anchor for the run receipt. Not creator-payment settlement. |

`test-settle-*` and `0xmock*` identifiers are always classified as
`demo_test_settlement`. They are visible in the ledger, but excluded from the dashboard's
“testnet USDC settled” totals and never described as creator payouts.

The code can create and verify a user-signed Arc mainnet run-receipt anchor. Assay may
only display **“Run receipt anchored on Arc mainnet”** after the backend verifies the
transaction through the configured mainnet RPC. Configuring an RPC URL, preparing a
receipt, or submitting an unmined transaction is not evidence of a mainnet anchor.

No Arc mainnet creator-payment settlement is claimed. The anchor proves the canonical
run receipt and decision ledger described below; it does not prove that a creator was
paid.

## What the prototype demonstrates

- An EIP-712 spending authorization and server-enforced cap.
- A deterministic VoI engine that emits one `BUY`, `SKIP`, or `CACHE` decision and a
  rationale for every candidate.
- A Python/LangGraph agent with a streamed SSE run feed.
- A TypeScript registry, decision ledger, payment-stage ledger, and aggregate views.
- An Arc testnet x402/Circle Gateway integration when a funded testnet paymaster is
  manually configured.
- Explicit separation of demo events, payment intents, and testnet settlement records.
- A canonical run receipt that a user can anchor with a zero-value, user-signed call to
  Arc's predeployed Memo contract; the server independently verifies and persists the proof.

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
  src/receipt.ts       Canonical receipt, keccak256 hash, and ASSAY_V1 calldata
  src/arcMemo.ts       Arc Memo contract receipt-anchor transaction builder
  src/receiptAnchor.ts Arc mainnet transaction verification
  src/receiptArtifact.ts Machine-readable verified proof artifact
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
| `assay-backend` | `backend` | `npm ci --include=dev && npm run build` | `npm start` |
| `assay-agent` | `agent` | `pip install -r requirements.txt` | `uvicorn api:app --host 0.0.0.0 --port $PORT` |

Both expose `GET /health`. The backend binds to `0.0.0.0:$PORT`. The Blueprint also
attaches a persistent disk at `/var/data` and uses
`ASSAY_DB=/var/data/assay.sqlite`; without a persistent disk, SQLite state disappears
on redeploy. Render persistent disks require a paid service instance; the current
SQLite build is therefore not durable on Render Free.

The backend build explicitly includes `devDependencies` even though `NODE_ENV` is
`production`: `patch-package` must apply the checked-in Circle compatibility patch and
TypeScript must run the build-time typecheck. These are build tools, not secrets or
production feature flags.

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
CORS_ORIGIN=https://www.assay-web.site,https://assay-web.site,https://assay-web.vercel.app
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

The Arc mainnet receipt anchor also needs no server wallet or private key. The user signs
and broadcasts the zero-value transaction in their browser wallet. They still need a
small Arc mainnet gas balance in that wallet.

### Agent environment

```dotenv
ASSAY_RUNTIME=production
ASSAY_BACKEND_URL=https://assay-backend-07w0.onrender.com
CORS_ORIGIN=https://www.assay-web.site,https://assay-web.site,https://assay-web.vercel.app
ASSAY_TEST_SETTLE=0
ASSAY_MOCK_PAY=0
```

The production agent refuses localhost, loopback, and `*.trycloudflare.com` backend
URLs. Public `/run` callers cannot override the backend URL.

### Vercel environment

Set these values for the Production environment, then redeploy:

```dotenv
NEXT_PUBLIC_BACKEND_URL=https://assay-backend-07w0.onrender.com
NEXT_PUBLIC_AGENT_URL=https://assay-agent.onrender.com
```

The Next.js production build fails if either URL is missing or points to localhost,
loopback, or `*.trycloudflare.com`. These are public service origins, not secrets.

### Verify after deployment

```bash
curl --fail https://assay-backend-07w0.onrender.com/health
curl --fail https://assay-agent.onrender.com/health
```

Then redeploy Vercel and open <https://www.assay-web.site/app>. Payment-stage events
must be labelled by provenance. A demo/test record must never appear as settled USDC.

## Arc mainnet run-receipt proof

After a run completes, the backend constructs canonical JSON containing the task and
prompt hash, authorization signer and signed cap, ordered decision hashes, ordered
payment items with explicit provenance, ledger completion timestamp, and receipt
creation timestamp. It hashes those UTF-8 bytes with `keccak256`.

The browser asks the authorization signer to switch to Arc mainnet (chain `5042`) and
send a zero-value call to Arc's predeployed
[Memo contract](https://docs.arc.io/arc/concepts/transaction-memos). The wrapper makes a
read-only USDC `balanceOf(signer)` child call, uses the receipt hash as `memoId`, and stores
the ASCII bytes `ASSAY_V1` followed by the exact 32-byte receipt hash as the memo bytes.
This does not transfer USDC or change an allowance. The backend only marks the receipt
verified after its mainnet RPC confirms all of the following:

- RPC and transaction chain are Arc mainnet (`5042`);
- transaction is mined successfully;
- `from` equals the authorization signer;
- `to` equals Arc's official Memo predeploy
  (`0x5294E9927c3306DcBaDb03fe70b92e01cCede505`);
- value is zero;
- calldata exactly matches the prepared Memo call, including the receipt hash and memo bytes.

Verified records are persisted in SQLite. A machine-readable artifact is downloadable
from `GET /receipts/:id/artifact`; the backend also writes
`artifacts/mainnet-receipt-anchor.json` beside the configured SQLite database (for the
Render layout: `/var/data/artifacts/mainnet-receipt-anchor.json`). The artifact includes
the canonical hash input, receipt/transaction hashes, block, signer, chain, timestamps,
and explorer URL.

### Reviewer path

1. Open <https://www.assay-web.site/app> and connect the wallet that will sign the
   authorization.
2. Complete the authorization → agent run flow.
3. Inspect the decision ledger and provenance-labelled payment stage. Demo/test events
   are not creator-payment settlements.
4. Click **Create Arc mainnet receipt proof** after synthesis completes.
5. Approve the wallet network switch and sign the zero-value Arc Memo transaction.
6. Wait for backend verification, then open the displayed Arc explorer link.
7. Download **Receipt artifact** and verify that its `receiptHash` is the keccak256 of
   `hashInput.canonicalJson` and that its Memo calldata commits to
   `ASSAY_V1 + receiptHash`.

Until a real transaction completes this path and its explorer URL/artifact are retained,
do not claim that a mainnet proof exists. Even after verification, describe it as an Arc
mainnet **run-receipt anchor**, never as Arc mainnet creator-payment settlement.
