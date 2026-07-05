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
            chainName: "Arc Testnet",
            nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
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
