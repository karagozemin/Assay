/**
 * Arc Testnet constants for the web app (mirror of backend/src/arc.ts).
 * Kept as a standalone module so it can be imported in the browser without pulling
 * in server-only deps like viem's node transport.
 */
export const ARC = {
  NETWORK: "eip155:5042002",
  CHAIN_ID: 5042002,
  RPC_URL: "https://rpc.testnet.arc.network",
  USDC: "0x3600000000000000000000000000000000000000",
  EXPLORER: "https://testnet.arcscan.app",
} as const;
