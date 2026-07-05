# Assay — Step 1 Payments PoC

> One real testnet USDC nanopayment through an **x402-protected endpoint** on **Arc testnet**,
> settled via **Circle Gateway batched nanopayments**. This is the payment plumbing the rest of
> Assay is built on — nothing else matters until this works.

## What this proves

- A seller exposes a protected route (`GET /source/1`) guarded by x402.
- An unpaid request returns **HTTP 402 Payment Required** with a signed x402 challenge
  (network `eip155:5042002` = Arc testnet, asset = USDC, `payTo` = creator wallet,
  scheme = `GatewayWalletBatched`).
- The buyer deposits USDC into its Circle Gateway balance, pays the endpoint, and the
  seller returns the protected content plus a settlement receipt.

## Stack (verified against the SDK)

| Thing | Value |
| --- | --- |
| Network (CAIP-2) | `eip155:5042002` |
| Chain id | `5042002` (viem `arcTestnet`) |
| RPC | `https://rpc.testnet.arc.network` |
| USDC (6 dp) | `0x3600000000000000000000000000000000000000` |
| Gateway wallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| Facilitator | `https://gateway-api-testnet.circle.com` |
| SDK | `@circle-fin/x402-batching` (client + server) |

## Files

- `arc.ts` — shared Arc testnet constants.
- `generate-wallets.ts` — creates CREATOR + BUYER wallets → `.env.local`.
- `fund.ts` — deposits BUYER wallet USDC into its Gateway balance.
- `server.ts` — the x402-protected seller (`GET /source/1`, price `$0.001`).
- `buyer.ts` — deposits (if needed) and pays the endpoint, prints the receipt.

## Run it

```bash
npm install

# 1. Generate CREATOR + BUYER wallets (writes .env.local — gitignored)
npm run generate-wallets

# 2. Fund the BUYER address printed above with Arc-testnet USDC:
#    https://faucet.circle.com/   (select Arc testnet)

# 3. Deposit that USDC into the buyer's Gateway balance
npm run fund            # optional amount arg, e.g. `npm run fund 0.5`

# 4. Start the seller (new terminal)
npm run seller

# 5. Pay the protected endpoint — real testnet USDC moves
npm run buy
```

`npm run buy` prints the settlement id and a link to verify the transfer on the facilitator.

## Verify the 402 challenge yourself

```bash
npm run seller           # in one terminal
curl -s -D - http://localhost:4021/source/1   # in another — note the PAYMENT-REQUIRED header
```

The `PAYMENT-REQUIRED` header is base64url JSON; decode it to inspect the exact price,
`payTo`, network, and Gateway verifying contract.
