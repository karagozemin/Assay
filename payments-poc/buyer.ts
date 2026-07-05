/**
 * Step 1 PoC buyer.
 *
 * Uses the funded BUYER wallet directly (no ephemeral wallet in the PoC — that
 * complexity comes later in the agent). Deposits USDC into the Circle Gateway
 * balance, then pays the x402-protected endpoint and prints the settlement receipt.
 */
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { ARC } from "./arc.ts";

const pk = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
if (!pk) {
  console.error("Missing BUYER_PRIVATE_KEY. Run `npm run generate-wallets` first.");
  process.exit(1);
}

const url = process.argv[2] ?? `http://localhost:${process.env.PORT ?? 4021}/source/1`;
const DEPOSIT_AMOUNT = process.env.DEPOSIT_AMOUNT ?? "0.5";

const client = new GatewayClient({ chain: "arcTestnet", privateKey: pk });

async function main() {
  console.log("Checking Gateway balance...");
  let balances = await client.getBalances();
  console.log(`  wallet USDC:   ${balances.wallet.formatted ?? balances.wallet.balance}`);
  console.log(`  gateway avail: ${balances.gateway.formattedAvailable}`);

  // Ensure there is Gateway balance to spend from.
  if (balances.gateway.available < 100_000n) {
    console.log(`Depositing ${DEPOSIT_AMOUNT} USDC into Gateway...`);
    const dep = await client.deposit(DEPOSIT_AMOUNT);
    console.log(`  deposit tx: ${dep.depositTxHash}`);
    balances = await client.getBalances();
    console.log(`  gateway avail now: ${balances.gateway.formattedAvailable}`);
  }

  console.log(`\nPaying x402 endpoint: ${url}`);
  const start = Date.now();
  const { status, data } = await client.pay(url);
  const ms = Date.now() - start;

  console.log(`\nHTTP ${status} in ${ms}ms`);
  console.log(JSON.stringify(data, null, 2));

  const settlementId = (data as any)?.settlementId;
  if (settlementId) {
    console.log(`\nSettlement id: ${settlementId}`);
    console.log(`Verify: ${ARC.FACILITATOR_URL}/v1/x402/transfers/${settlementId}`);
  }
  console.log("\nStep 1 complete: real testnet USDC moved through an x402-protected endpoint.");
}

main().catch((err) => {
  console.error("Payment failed:", err?.message ?? err);
  process.exit(1);
});
