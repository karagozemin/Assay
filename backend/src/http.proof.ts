/**
 * HTTP-proof harness (companion to mandate.proof.ts).
 *
 * mandate.proof.ts proves the ENFORCEMENT FUNCTIONS in isolation (11/11). This proves
 * the same guarantee end-to-end over LIVE HTTP against the running route handler:
 *
 *   1. It seeds a real source directly in the DB (bypassing only the on-chain creator
 *      proofTx gate, which is orthogonal to spend enforcement).
 *   2. It signs a REAL EIP-712 SpendingAuthorization (cap $0.005) with a fresh wallet
 *      and registers it via POST /authorizations — so the mandate lives in the running
 *      server's memory, exactly as a browser wallet would create it.
 *   3. It prints { sourceId, authorizationId } as JSON for the curl script to consume.
 *
 * The curl script then hits POST /pay/settle directly (no UI) to show that the route
 * handler wires to authorizeSpend BEFORE paying: no-auth → 401, cumulative over-cap →
 * 403, within-cap → 200. Run with ASSAY_TEST_SETTLE=1 so the within-cap 200 is real
 * without a funded wallet or testnet USDC.
 */
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { getAddress } from "viem";
import { ARC } from "./arc.ts";
import { embed } from "./embed.ts";
import { createCreator, createSource } from "./db.ts";

const PORT = Number(process.env.PORT ?? 4000);
const BASE = `http://127.0.0.1:${PORT}`;

// EIP-712 shape — MUST match backend/src/mandate.ts exactly.
const DOMAIN = {
  name: "Assay Spending Authorization",
  version: "1",
  chainId: ARC.CHAIN_ID,
  verifyingContract: ARC.USDC,
} as const;

const TYPES = {
  SpendingAuthorization: [
    { name: "user", type: "address" },
    { name: "token", type: "address" },
    { name: "cap", type: "uint256" },
    { name: "nonce", type: "string" },
    { name: "expiry", type: "uint256" },
  ],
} as const;

async function main() {
  // --- seed a source (price $0.002 each) directly, bypassing only the creator proofTx gate.
  const creator = createCreator(
    `HTTP Proof Creator ${Date.now()}`,
    "0x1111111111111111111111111111111111111111",
    "seed-http-proof",
  );
  const title = "HTTP Proof Source";
  const abstract = "A seeded source used to prove /pay/settle cap enforcement over live HTTP.";
  const source = createSource({
    creatorId: creator.id,
    title,
    abstract,
    content: "PAID CONTENT — should only ever be returned after a cap check passes.",
    price: 0.002,
    tags: ["proof"],
    qualityPrior: 0.7,
    embedding: embed(`${title}. ${abstract}`),
  });

  // --- sign a REAL EIP-712 mandate with cap $0.005 and register it over HTTP.
  const account = privateKeyToAccount(generatePrivateKey());
  const capUnits = 5000n; // 0.005 USDC * 1e6
  const nonce = `http-proof-${Date.now()}`;
  const expiry = Math.floor(Date.now() / 1000) + 600;

  const signature = await account.signTypedData({
    domain: DOMAIN,
    types: TYPES,
    primaryType: "SpendingAuthorization",
    message: {
      user: getAddress(account.address),
      token: getAddress(ARC.USDC),
      cap: capUnits,
      nonce,
      expiry: BigInt(expiry),
    },
  });

  const reg = await fetch(`${BASE}/authorizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: account.address,
      token: ARC.USDC,
      cap: capUnits.toString(),
      nonce,
      expiry,
      signature,
    }),
  });
  const regBody = (await reg.json()) as { id: string; capUsdc: number };
  if (!reg.ok) {
    throw new Error(`registration failed (${reg.status}): ${JSON.stringify(regBody)}`);
  }

  process.stdout.write(
    JSON.stringify({
      sourceId: source.id,
      authorizationId: regBody.id,
      wallet: account.address,
      capUsdc: regBody.capUsdc,
      priceUsdc: source.price,
    }) + "\n",
  );
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
