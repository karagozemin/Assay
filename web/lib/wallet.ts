/**
 * Browser wallet helpers for creator registration.
 *
 * Proof-of-control: to register a wallet as a creator, the browser wallet (MetaMask,
 * etc.) must sign & broadcast a tiny self-transaction on Arc testnet. The backend then
 * verifies on-chain that this tx was sent FROM the wallet being registered — so nobody
 * can register an address they don't actually control.
 */
import { ARC } from "@/lib/arcNetwork";


type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

const ARC_CHAIN_ID_HEX = "0x" + ARC.CHAIN_ID.toString(16);
const ARC_MAINNET = {
  chainId: 5042,
  rpcUrl: "https://rpc.mainnet.arc.io",
  explorerUrl: "https://explorer.arc.io",
} as const;
const ARC_MAINNET_CHAIN_ID_HEX = `0x${ARC_MAINNET.chainId.toString(16)}`;

function getProvider(): Eip1193Provider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error(
      "No browser wallet found. Install MetaMask (or a compatible EVM wallet) to register.",
    );
  }
  return window.ethereum;
}

/** Prompt the user to connect and return the selected account address. */
export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  const accounts: string[] = await provider.request({
    method: "eth_requestAccounts",
  });
  if (!accounts?.length) throw new Error("No account authorized in wallet.");
  return accounts[0];
}

/** Ensure the wallet is on Arc testnet, adding the network if it isn't known yet. */
export async function ensureArcNetwork(): Promise<void> {
  const provider = getProvider();
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN_ID_HEX }],
    });
  } catch (err: any) {
    // 4902 = chain not added to the wallet yet → add it, then it becomes active.
    if (err?.code === 4902 || /Unrecognized chain/i.test(err?.message ?? "")) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ARC_CHAIN_ID_HEX,
            // Match the wallet's chain registry so no "name/symbol mismatch"
            // warnings are shown when the network is added.
            chainName: "Arc Network Testnet",
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            rpcUrls: [ARC.RPC_URL],
            blockExplorerUrls: [ARC.EXPLORER],
          },

        ],
      });
    } else {
      throw err;
    }
  }
}

/**
 * Broadcast a 0-value self-transaction from `address` on Arc and return the tx hash.
 * This is the on-chain proof the backend verifies at registration time.
 */
export async function sendProofTx(address: string): Promise<string> {
  const provider = getProvider();
  const txHash: string = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: address,
        to: address,
        value: "0x0",
      },
    ],
  });
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error("Wallet did not return a valid transaction hash.");
  }
  return txHash;
}

/** Full registration proof flow: connect → ensure Arc → send self-tx → return {address, proofTx}. */
export async function proveWalletControl(): Promise<{
  address: string;
  proofTx: string;
}> {
  const address = await connectWallet();
  await ensureArcNetwork();
  const proofTx = await sendProofTx(address);
  return { address, proofTx };
}

/** Switch to Arc mainnet, adding the public network definition when necessary. */
export async function ensureArcMainnet(): Promise<void> {
  const provider = getProvider();
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_MAINNET_CHAIN_ID_HEX }],
    });
  } catch (err: any) {
    if (err?.code === 4902 || /Unrecognized chain/i.test(err?.message ?? "")) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ARC_MAINNET_CHAIN_ID_HEX,
            chainName: "Arc Mainnet",
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            rpcUrls: [ARC_MAINNET.rpcUrl],
            blockExplorerUrls: [ARC_MAINNET.explorerUrl],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

/** User-signed zero-value self-tx that anchors, but does not settle, a run receipt. */
export async function sendMainnetReceiptAnchor(
  expectedSigner: string,
  calldata: string,
): Promise<string> {
  if (!/^0x[a-fA-F0-9]+$/.test(calldata)) throw new Error("Invalid receipt calldata.");
  const provider = getProvider();
  const address = await connectWallet();
  if (address.toLowerCase() !== expectedSigner.toLowerCase()) {
    throw new Error("Connected wallet does not match the run authorization signer.");
  }
  await ensureArcMainnet();
  const accounts: string[] = await provider.request({ method: "eth_accounts" });
  if (!accounts?.[0] || accounts[0].toLowerCase() !== expectedSigner.toLowerCase()) {
    throw new Error("Arc mainnet wallet account changed; reconnect the authorization signer.");
  }
  const txHash: string = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: expectedSigner,
        to: expectedSigner,
        value: "0x0",
        data: calldata,
      },
    ],
  });
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error("Wallet did not return a valid Arc mainnet transaction hash.");
  }
  return txHash;
}

/* ---------------------------------------------------------------------------
 * Buyer-side spending authorization.
 *
 * A user (the one asking the research question) connects their wallet and signs
 * an off-chain EIP-712 "SpendingAuthorization": they grant the agent's paymaster
 * the right to spend up to `capUsdc` USDC on their behalf, until `expiry`. This is
 * the same shape a production pull-payment / permit flow would settle on-chain —
 * here it's a real client-side signature that gates how much the agent may spend
 * autonomously in a single run. No per-purchase popups: sign the cap once, the
 * agent deliberates and pays within it.
 * ------------------------------------------------------------------------- */

export type SpendingAuthorization = {
  address: string; // the user's wallet (spender-of-record)
  capUsdc: number; // max USDC the agent may spend this run
  token: string; // USDC token the cap is denominated in (Arc USDC)
  capUnits: string; // signed cap, in USDC base units (matches the signature exactly)
  nonce: string; // unique per authorization
  expiry: number; // unix seconds
  signature: string; // EIP-712 signature over the above
};


/** USDC has 6 decimals on Arc; caps are expressed in base units in the signed payload. */
const USDC_DECIMALS = 6n;
const toUsdcUnits = (usdc: number): string =>
  (BigInt(Math.round(usdc * 1e6)) * 10n ** (USDC_DECIMALS - 6n)).toString();

/**
 * Connect + ensure Arc + sign a spending cap. Returns a `SpendingAuthorization`.
 * The signature is produced with `eth_signTypedData_v4` — no transaction, no gas,
 * just a cryptographic grant the run then spends against.
 */
export async function authorizeSpending(capUsdc: number): Promise<SpendingAuthorization> {
  const provider = getProvider();
  const address = await connectWallet();
  await ensureArcNetwork();

  const nonce =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const expiry = Math.floor(Date.now() / 1000) + 60 * 30; // 30-minute grant
  const capUnits = toUsdcUnits(capUsdc);


  const typedData = {
    domain: {
      name: "Assay Spending Authorization",
      version: "1",
      chainId: ARC.CHAIN_ID,
      verifyingContract: ARC.USDC,
    },
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      SpendingAuthorization: [
        { name: "user", type: "address" },
        { name: "token", type: "address" },
        { name: "cap", type: "uint256" },
        { name: "nonce", type: "string" },
        { name: "expiry", type: "uint256" },
      ],
    },
    primaryType: "SpendingAuthorization",
    message: {
      user: address,
      token: ARC.USDC,
      cap: capUnits,
      nonce,
      expiry,
    },
  };


  const signature: string = await provider.request({
    method: "eth_signTypedData_v4",
    params: [address, JSON.stringify(typedData)],
  });
  if (!/^0x[a-fA-F0-9]{130}$/.test(signature)) {
    throw new Error("Wallet did not return a valid signature.");
  }

  return {
    address,
    capUsdc,
    token: ARC.USDC,
    capUnits,
    nonce,
    expiry,
    signature,
  };
}

