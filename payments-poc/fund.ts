/**
 * Step 1 PoC funding helper.
 *
 * Deposits BUYER wallet USDC into the Circle Gateway balance so nanopayments can be
 * settled from it. Run this once after funding the BUYER address from the faucet:
 *   1. npm run generate-wallets
 *   2. fund BUYER at https://faucet.circle.com/
 *   3. npm run fund          <- this script
 *   4. npm run seller / npm run buy
 *
 * Usage: npm run fund [amountUsdc]   (defaults to DEPOSIT_AMOUNT or 0.5)
 */
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { ARC } from "./arc.ts";

const pk = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
if (!pk) {
  console.error("Missing BUYER_PRIVATE_KEY. Run `npm run generate-wallets` first.");
  process.exit(1);
}

const amount = process.argv[2] ?? process.env.DEPOSIT_AMOUNT ?? "0.5";
const client = new GatewayClient({ chain: "arcTestnet", privateKey: pk });

async function main() {
  console.log(`Arc testnet (${ARC.NETWORK}) — funding Gateway balance`);
  console.log("Checking balances...");
  let balances = await client.getBalances();
  console.log(`  wallet USDC:      ${balances.wallet.formatted ?? balances.wallet.balance}`);
  console.log(`  gateway available: ${balances.gateway.formattedAvailable}`);

  if (balances.wallet.balance === 0n) {
    console.error(
      "\nBUYER wallet has 0 USDC. Fund it first at https://faucet.circle.com/ " +
        "(select Arc testnet), then re-run `npm run fund`.",
    );
    process.exit(1);
  }

  console.log(`\nDepositing ${amount} USDC into Gateway...`);
  const dep = await client.deposit(amount);
  console.log(`  deposit tx: ${dep.depositTxHash}`);
  console.log(`  explorer:   ${ARC.EXPLORER}/tx/${dep.depositTxHash}`);

  balances = await client.getBalances();
  console.log(`\nGateway available now: ${balances.gateway.formattedAvailable}`);
  console.log("Done. You can now run `npm run buy`.");
}

main().catch((err) => {
  console.error("Funding failed:", err?.message ?? err);
  process.exit(1);
});
