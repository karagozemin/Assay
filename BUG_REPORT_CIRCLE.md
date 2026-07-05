# Bug report — `@circle-fin/x402-batching@2.1.0` advertises a 4-day auth validity, but the Gateway facilitator requires ≥ 7 days → every batched x402 payment fails with `authorization_validity_too_short`

**Package:** `@circle-fin/x402-batching@2.1.0`
**Network:** Arc testnet (`eip155:5042002`, chain id `5042002`)
**Facilitator:** `https://gateway-api-testnet.circle.com`
**Scheme:** `GatewayWalletBatched`

---

## Summary

Out of the box, **every batched x402 nanopayment on Arc testnet fails** at settlement.
The buyer signs a valid EIP-3009 payment authorization, but the Gateway facilitator
rejects it with:

```
authorization_validity_too_short
```

Root cause is a mismatch **inside Circle's own stack**: the SDK hardcodes the payment
authorization validity window to **4 days**, while the Gateway facilitator (which batches
settlements asynchronously) requires the authorization to stay valid for **≥ 7 days
(604800 s)**. Because Gateway can settle the batch days after the buyer signs, it rejects
any authorization whose window is shorter than the settlement horizon.

## Repro

1. Set up a `GatewayWalletBatched` x402 seller with `createGatewayMiddleware` (price e.g. `$0.001`, `payTo` = a creator wallet) on Arc testnet.
2. Fund a buyer wallet's Gateway balance and pay the protected endpoint with the batching client.
3. The paid request fails: `Payment failed: authorization_validity_too_short`.

> Note: the client-side error originally swallowed the facilitator's `reason`. Surfacing
> `error.reason` in the thrown error is what let us isolate `authorization_validity_too_short`
> (small client-side patch below).

## Root cause

`maxTimeoutSeconds` is hardcoded to `345600` (4 days) in three places in the server
middleware (`dist/server/index.js` and `dist/server/index.mjs`):

- the `GatewayEvmScheme` payment-requirements builder
- `createGatewayMiddleware` — the paywall-style requirement
- `createGatewayMiddleware` — the `parsePrice` requirement

`345600 < 604800`, so the authorization window is shorter than the facilitator's minimum
and the payment is rejected before it can settle.

## Fix / workaround

Raise `maxTimeoutSeconds` above the facilitator's minimum (we use `700000`, i.e. > 7 days)
at all three server call sites. Applied via `patch-package`:

```diff
--- a/node_modules/@circle-fin/x402-batching/dist/server/index.js
+++ b/node_modules/@circle-fin/x402-batching/dist/server/index.js
@@ GatewayEvmScheme / createGatewayMiddleware (x3)
-      maxTimeoutSeconds: 345600,   // 4 days
+      maxTimeoutSeconds: 700000,   // > 7 days — matches Gateway's async settlement window
```

Plus a client-side diagnostics improvement so future failures aren't opaque:

```diff
--- a/node_modules/@circle-fin/x402-batching/dist/client/index.mjs
+++ b/node_modules/@circle-fin/x402-batching/dist/client/index.mjs
-        `Payment failed: ${error.error || paidResponse.statusText}`
+        `Payment failed: ${error.error || paidResponse.statusText}${error.reason ? ` | reason=${JSON.stringify(error.reason)}` : ""}`
```

After the patch, the batched nanopayment settles and real testnet USDC lands in the
creator wallet.

## Suggested upstream fix

1. Raise the default `maxTimeoutSeconds` for the batched scheme to exceed the facilitator's
   minimum settlement window (≥ 604800), or make it a config option on
   `createGatewayMiddleware` instead of a hardcoded constant.
2. Propagate the facilitator's `reason` field into the client error message so
   `authorization_validity_too_short` (and similar) are surfaced to developers.

## Impact

This blocks the entire batched-nanopayment happy path on Arc testnet for new integrators —
it's the first thing you hit when following the x402 batching flow. Fixing the default (or
exposing it) would make the SDK work out of the box.
