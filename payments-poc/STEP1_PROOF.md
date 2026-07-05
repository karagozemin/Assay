# BUILD ORDER — Step 1: Real testnet USDC nanopayment over x402 on Arc ✅

**Status: COMPLETE.** A real testnet USDC nanopayment moved through an
x402-protected endpoint on the Arc testnet, end-to-end, no mocks.

## Proof

```
POST http://localhost:4021/source/1  (x402-protected)
HTTP 402 Payment Required  → HTTP 200 in 671ms

{
  "sourceId": "1",
  "title": "Notes on marginal value-of-information in retrieval",
  "paidBy": "0x1a0540787f2d42ecf3c2e71dee400fda2d655611",
  "amountUsdc": "0.001",
  "network": "eip155:5042002",
  "settlementId": "1beffa95-3d42-4d07-8e1e-9e37e906d7b7",
  "explorer": "https://testnet.arcscan.app/tx/1beffa95-3d42-4d07-8e1e-9e37e906d7b7"
}
```

Circle Gateway settlement verification:

```
GET https://gateway-api-testnet.circle.com/v1/x402/transfers/1beffa95-3d42-4d07-8e1e-9e37e906d7b7
→ { "status": "received", "value": "1000", "token": "USDC" }
```

`value: 1000` = 1000 micro-USDC (6 decimals) = **$0.001**.

## Flow proven
1. Buyer requests the protected source endpoint → seller returns **402 Payment Required**
   with price + `payTo` (creator wallet) via `@circle-fin/x402-batching` Gateway middleware.
2. Buyer signs a Gateway nanopayment authorization and retries.
3. Seller verifies with the Gateway facilitator, settles, returns **200 + content**.
4. Buyer receives a `settlementId` confirmable against the Circle Gateway API.

## Two bugs found in `@circle-fin/x402-batching@2.1.0` (patched via patch-package)

The fixes live in `patches/@circle-fin+x402-batching+2.1.0.patch` and are re-applied
automatically on every `npm install` via the `postinstall: patch-package` hook — so the
repo is reproducible without hand-editing `node_modules`.

### Bug 1 (the blocker): `authorization_validity_too_short`
The seller middleware advertised `maxTimeoutSeconds: 345600` (4 days). The client signs
`validBefore = now + maxTimeoutSeconds`, but the Gateway facilitator **requires the
authorization to be valid for at least 604800s (7 days)** and rejects shorter windows.

Fix: bump the three advertised `maxTimeoutSeconds` occurrences to `700000`
(≈8.1 days, safely above the 7-day floor with headroom for clock skew / batching delay).

### Bug 2 (diagnostics): silent failure reason
The client's error path discarded the facilitator's `reason` field, so failures only
said "Payment verification failed". Patched to surface
`| reason="authorization_validity_too_short"`, which is how Bug 1 was diagnosed.

## Run it

```bash
cd payments-poc
npm install                 # applies the patch automatically (postinstall)
npm run seller              # starts the x402-protected source endpoint on :4021
npm run buy                 # buyer pays $0.001 and receives the content
```
