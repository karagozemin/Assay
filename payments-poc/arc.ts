/**
 * Shared Arc Testnet constants for Assay.
 * Values verified against the circlefin/arc-nanopayments and the-canteen-dev/circle-agent
 * reference repos. Arc testnet gas is paid in USDC (18 decimals for native, 6 for ERC-20).
 */
export const ARC = {
  // CAIP-2 network id used by the x402 batching SDK / facilitator.
  NETWORK: "eip155:5042002",
  CHAIN_ID: 5042002,
  RPC_URL: "https://rpc.testnet.arc.network",
  // ERC-20 USDC on Arc testnet (6 decimals).
  USDC: "0x3600000000000000000000000000000000000000" as `0x${string}`,
  // Circle Gateway batched-settlement wallet (x402 verifyingContract).
  GATEWAY_WALLET: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as `0x${string}`,
  // Circle Gateway facilitator (testnet).
  FACILITATOR_URL: "https://gateway-api-testnet.circle.com",
  // Block explorer.
  EXPLORER: "https://testnet.arcscan.app",
} as const;
