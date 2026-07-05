/**
 * Step 1 PoC seller.
 *
 * An x402-protected endpoint on Arc testnet. Unpaid requests get 402 Payment Required;
 * paid requests (via Circle Gateway batched settlement) return the protected content and
 * a settlement receipt. This is the minimal end-to-end proof that real testnet USDC moves.
 */
import express from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { formatUnits } from "viem";
import { ARC } from "./arc.ts";

const CREATOR = process.env.CREATOR_ADDRESS;
if (!CREATOR) {
  console.error("Missing CREATOR_ADDRESS. Run `npm run generate-wallets` first.");
  process.exit(1);
}

type PaidRequest = express.Request & {
  payment?: {
    verified: boolean;
    payer: string;
    amount: string;
    network: string;
    transaction?: string;
  };
};

const app = express();
app.use(express.json());

const gateway = createGatewayMiddleware({
  sellerAddress: CREATOR,
  facilitatorUrl: ARC.FACILITATOR_URL,
  networks: [ARC.NETWORK],
});

const PRICE = process.env.PRICE ?? "$0.001";

// The protected source content endpoint.
app.get("/source/1", gateway.require(PRICE), (req: PaidRequest, res) => {
  const { payer, amount, network, transaction } = req.payment!;
  const formatted = formatUnits(BigInt(amount), 6);
  console.log(
    `[paid] ${formatted} USDC by ${payer} on ${network} settlement=${transaction ?? "?"}`,
  );
  res.json({
    sourceId: "1",
    title: "Notes on marginal value-of-information in retrieval",
    content:
      "When two sources overlap heavily, the second buys you little: expected " +
      "information gain scales with novelty, not raw relevance. Budget should be " +
      "allocated to the highest marginal-gain-per-dollar sources until the marginal " +
      "gain drops below a stopping threshold.",
    paidBy: payer,
    amountUsdc: formatted,
    network,
    settlementId: transaction,
    explorer: transaction ? `${ARC.EXPLORER}/tx/${transaction}` : null,
  });
});

app.get("/health", (_req, res) => res.json({ ok: true, creator: CREATOR }));

const PORT = Number(process.env.PORT ?? 4021);
app.listen(PORT, () => {
  console.log(`Assay PoC seller listening on http://localhost:${PORT}`);
  console.log(`  creator (payTo): ${CREATOR}`);
  console.log(`  price:           ${PRICE}`);
  console.log(`  protected route: GET /source/1`);
});
