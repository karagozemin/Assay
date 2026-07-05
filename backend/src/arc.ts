/**
 * Shared Arc Testnet constants (verified end-to-end in payments-poc).
 * Arc testnet USDC has 6 decimals; the CAIP-2 network id is used by the x402 batching SDK.
 */
export const ARC = {
  NETWORK: "eip155:5042002",
  CHAIN_ID: 5042002,
  RPC_URL: "https://rpc.testnet.arc.network",
  USDC: "0x3600000000000000000000000000000000000000" as `0x${string}`,
  GATEWAY_WALLET: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as `0x${string}`,
  FACILITATOR_URL: "https://gateway-api-testnet.circle.com",
  EXPLORER: "https://testnet.arcscan.app",
} as const;

/** Build a facilitator link to verify a settlement/transfer by id. */
export function transferUrl(settlementId: string): string {
  return `${ARC.FACILITATOR_URL}/v1/x402/transfers/${settlementId}`;
}
