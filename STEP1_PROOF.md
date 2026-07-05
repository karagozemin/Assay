# STEP 1 — Real testnet USDC nanopayment over x402 on Arc ✅

> **Goal (Build Order #1):** get ONE x402-protected endpoint paid by ONE agent on Arc
> testnet, end-to-end, with a real USDC nanopayment. Nothing else mattered until this
> worked. It works — and getting it to work surfaced a real SDK bug in
> `@circle-fin/x402-batching` (documented below, submitted to Circle as feedback).

---

## What was proven

- A seller exposes an **x402-protected** route (`GET /source/1`, price `$0.001`).
- An unpaid request returns **HTTP 402 Payment Required** with a signed x402 challenge:
  - network `eip155:5042002` (Arc testnet), asset = USDC, scheme = `GatewayWalletBatched`,
    `payTo` = creator wallet.
- The buyer agent deposits USDC into its **Circle Gateway** balance, pays the endpoint,
  the seller returns the protected content **plus a settlement receipt**, and real
  testnet USDC moves to the creator wallet.

### Verified stack

| Thing | Value |
| --- | --- |
| Network (CAIP-2) | `eip155:5042002` |
| Chain id | `5042002` (viem `arcTestnet`) |
| RPC | `https://rpc.testnet.arc.network` |
| USDC (6 dp) | `0x3600000000000000000000000000000000000000` |
| Gateway wallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| Facilitator | `https://gateway-api-testnet.circle.com` |
| SDK | `@circle-fin/x402-batching@2.1.0` (client + server) |

### Reproduce

```bash
cd payments-poc
npm install                 # applies the patch below via patch-package postinstall
npm run generate-wallets    # creates CREATOR + BUYER wallets → .env.local
# fund the printed BUYER address with Arc-testnet USDC at https://faucet.circle.com/
npm run fund                # deposit into the buyer's Gateway balance
npm run seller              # terminal A — the x402 seller on :4021
npm run buy                 # terminal B — pays the endpoint; prints settlement id
```

Inspect the raw 402 challenge:

```bash
curl -s -D - http://localhost:4021/source/1   # decode the base64url PAYMENT-REQUIRED header
```

---

## 🐛 SDK bug found & patched — `authorization_validity_too_short`

While wiring step 1, **every batched x402 payment failed** at the settlement step. The
buyer signed a valid payment authorization, but the Gateway facilitator rejected it.

### Symptom

```
Payment failed: authorization_validity_too_short
```

(The generic client-side error originally swallowed the facilitator's `reason`; we
also patched the client to surface `error.reason`, which is how we isolated it.)

### Root cause

`@circle-fin/x402-batching@2.1.0` **hardcodes** the payment authorization validity
window to **`maxTimeoutSeconds: 345600` (4 days)** in three places in the server
middleware (`dist/server/index.js` and `dist/server/index.mjs`):

- `GatewayEvmScheme` payment-requirements builder
- `createGatewayMiddleware` — the `paywall`-style requirement
- `createGatewayMiddleware` — the `parsePrice` requirement

The Gateway facilitator on Arc testnet, however, requires the authorization to remain
valid for **≥ 7 days (604800 s)** because Gateway batches settlements asynchronously —
the on-chain settlement can land days after the buyer signs. With a 4-day window the
authorization can expire before the batch settles, so the facilitator rejects the EIP-3009
authorization up front with `authorization_validity_too_short`.

**In short:** the SDK advertises a 4-day auth validity, but the facilitator it talks to
demands ≥ 7 days. The two are mismatched inside Circle's own stack, so the happy path is
broken out of the box for batched payments.

### Fix (shipped in `payments-poc/patches/@circle-fin+x402-batching+2.1.0.patch`)

Raise `maxTimeoutSeconds` from `345600` to `700000` (> 604800) at all three server call
sites, and surface the facilitator's `reason` in the client error so failures are
diagnosable. Applied automatically via `patch-package` on `postinstall`.

```diff
-      maxTimeoutSeconds: 345600,   // 4 days
+      maxTimeoutSeconds: 700000,   // > 7 days — matches Gateway's async settlement window
```

```diff
-        `Payment failed: ${error.error || paidResponse.statusText}`
+        `Payment failed: ${error.error || paidResponse.statusText}${error.reason ? ` | reason=${JSON.stringify(error.reason)}` : ""}`
```

After the patch, the batched nanopayment settles and real testnet USDC lands in the
creator wallet. This is the plumbing every `PAY` node in the Assay agent runs on.

> The clean, standalone version of this report (for Circle's feedback channel) lives in
> [`BUG_REPORT_CIRCLE.md`](./BUG_REPORT_CIRCLE.md).
