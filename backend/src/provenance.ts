import type { PaymentProvenance } from "./types.ts";

const ARC_TESTNET_NETWORK = "eip155:5042002";

export function classifyPaymentProvenance(
  proof: string,
  requested: unknown,
  network: string,
): PaymentProvenance {
  if (proof.startsWith("test-settle-") || proof.startsWith("0xmock")) {
    return "demo_test_settlement";
  }
  if (requested === "arc_testnet_x402" && network === ARC_TESTNET_NETWORK) {
    return "arc_testnet_x402";
  }
  return "payment_intent";
}
