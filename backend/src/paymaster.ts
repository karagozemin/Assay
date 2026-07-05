/**
 * Assay paymaster — the BUYER side of the x402 flow.
 *
 * The agent's spending brain lives in Python, but the Circle Gateway batching SDK is
 * Node-only. So the backend exposes the agent's paying wallet as a service: given a
 * source's protected content URL, this module uses the funded BUYER wallet to run the
 * real x402 flow (GET → 402 → authorize a Gateway nanopayment on Arc testnet → retry),
 * then hands back the content plus the on-chain settlement proof.
 *
 * This is the REAL payment path. `ASSAY_MOCK_PAY=1` on the agent side bypasses this
 * entirely and is a dev-only convenience; the final demo path calls this module and
 * real testnet USDC moves.
 */
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { formatUnits } from "viem";
import { ARC } from "./arc.ts";

const BUYER_PK = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
const BUYER_ADDRESS = process.env.BUYER_ADDRESS ?? "";
// Keep a comfortable Gateway balance so a batch of sub-cent buys never stalls mid-run.
const DEPOSIT_AMOUNT = process.env.DEPOSIT_AMOUNT ?? "0.5";
// Below this (0.1 USDC in 6-decimals) we top the Gateway balance back up.
const MIN_GATEWAY_UNITS = 100_000n;

let client: GatewayClient | null = null;
// Serialize deposits so a burst of concurrent buys doesn't fire N deposits at once.
let depositInFlight: Promise<void> | null = null;

export function paymasterReady(): boolean {
  return Boolean(BUYER_PK);
}

function getClient(): GatewayClient {
  if (!BUYER_PK) {
    throw new Error(
      "BUYER_PRIVATE_KEY not set — cannot settle real payments. " +
        "Set it in backend/.env.local (or run the agent with ASSAY_MOCK_PAY=1).",
    );
  }
  if (!client) {
    client = new GatewayClient({ chain: "arcTestnet", privateKey: BUYER_PK });
  }
  return client;
}

async function ensureGatewayBalance(): Promise<void> {
  const c = getClient();
  const balances = await c.getBalances();
  if (balances.gateway.available >= MIN_GATEWAY_UNITS) return;

  // Coalesce concurrent top-ups into one deposit.
  if (!depositInFlight) {
    depositInFlight = (async () => {
      const dep = await c.deposit(DEPOSIT_AMOUNT);
      console.log(
        `[paymaster] deposited ${DEPOSIT_AMOUNT} USDC into Gateway (tx ${dep.depositTxHash})`,
      );
    })().finally(() => {
      depositInFlight = null;
    });
  }
  await depositInFlight;
}

export interface SettleResult {
  proof: string; // on-chain settlement id (tx hash)
  payer: string;
  amountUsdc: number;
  network: string;
  content: string; // the paid-for source content
  explorer: string | null;
}

/**
 * Pay the x402-protected content URL for `sourceId` and return the settled content
 * plus proof. `absoluteUrl` must be a fully-qualified URL the Gateway client can GET
 * (e.g. http://localhost:4000/content/<id>).
 */
export async function settle(sourceId: string, absoluteUrl: string): Promise<SettleResult> {
  await ensureGatewayBalance();
  const c = getClient();

  const { status, data } = await c.pay(absoluteUrl);
  if (status !== 200) {
    throw new Error(`x402 pay for source ${sourceId} returned HTTP ${status}`);
  }

  const d = data as any;
  const pay = d?.payment ?? {};
  const settlementId: string | undefined = pay.settlementId ?? d?.settlementId;
  if (!settlementId) {
    throw new Error(`no settlement id returned for source ${sourceId}`);
  }

  // `content` may already be a string; if the SDK handed us a raw amount, format it.
  const amountUsdc =
    typeof pay.amountUsdc === "number"
      ? pay.amountUsdc
      : pay.amount
        ? Number(formatUnits(BigInt(pay.amount), 6))
        : 0;

  const content =
    typeof d?.content === "string" ? d.content : JSON.stringify(d?.content ?? "");

  return {
    proof: settlementId,
    payer: pay.payer ?? BUYER_ADDRESS,
    amountUsdc,
    network: pay.network ?? ARC.NETWORK,
    content,
    explorer: `${ARC.EXPLORER}/tx/${settlementId}`,
  };
}
