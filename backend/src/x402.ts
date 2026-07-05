/**
 * x402 seller middleware factory.
 *
 * The Gateway middleware fixes `sellerAddress` at construction time, but Assay pays MANY
 * different creator wallets. So we cache one gateway instance per creator wallet address and
 * hand back the right `.require(price)` middleware for whichever source is being requested.
 */
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import type { Request, Response, NextFunction } from "express";
import { ARC } from "./arc.ts";

type Middleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

export interface PaymentInfo {
  verified: boolean;
  payer: string;
  amount: string;
  network: string;
  transaction?: string;
}

const gatewayCache = new Map<string, ReturnType<typeof createGatewayMiddleware>>();

function gatewayFor(sellerAddress: string) {
  const key = sellerAddress.toLowerCase();
  let g = gatewayCache.get(key);
  if (!g) {
    g = createGatewayMiddleware({
      sellerAddress,
      facilitatorUrl: ARC.FACILITATOR_URL,
      networks: [ARC.NETWORK],
    });
    gatewayCache.set(key, g);
  }
  return g;
}

/** Build a per-request x402 gate: pay `price` USDC to `sellerAddress` or get 402. */
export function requirePayment(sellerAddress: string, price: number): Middleware {
  return gatewayFor(sellerAddress).require(`$${price}`);
}
