/**
 * Spending-mandate verification + enforcement.
 *
 * A "buyer" (the person asking the research question) signs an off-chain EIP-712
 * `SpendingAuthorization` in their browser wallet: they grant the agent's paymaster
 * the right to spend up to `cap` USDC on their behalf until `expiry`. No transaction,
 * no gas — just a cryptographic mandate.
 *
 * This module is the SERVER-SIDE chokepoint that makes that mandate real:
 *   - registerAuthorization(): recover the signer (viem verifyTypedData), confirm it
 *     equals the claimed wallet, check chainId + token + expiry, reject nonce reuse,
 *     and store the mandate with a running spend ledger.
 *   - authorizeSpend(): called before EVERY payment. Atomically checks that
 *     (spent_so_far + this_payment) <= cap and that the mandate is still valid, then
 *     debits the ledger. If it returns { ok:false } the payment MUST NOT execute.
 *
 * The paymaster wallet keeps paying (a legitimate relayer pattern) but it can ONLY
 * pay within a verified, signed, non-expired mandate. Calling /pay/settle directly,
 * bypassing the UI, cannot exceed the signed cap — the cap lives here, not in the UI.
 */
import { randomUUID } from "node:crypto";
import { verifyTypedData, getAddress, formatUnits } from "viem";
import { ARC } from "./arc.ts";

/** EIP-712 shape — MUST match web/lib/wallet.ts exactly (minus EIP712Domain, which viem derives). */
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

export interface SignedAuthorization {
  user: `0x${string}`;
  token: `0x${string}`;
  cap: string; // USDC base units (6 decimals), as a decimal string
  nonce: string;
  expiry: number; // unix seconds
  signature: `0x${string}`;
}

interface StoredMandate {
  id: string;
  user: `0x${string}`;
  capUnits: bigint; // signed cap, in USDC base units
  spentUnits: bigint; // running total already authorized
  nonce: string;
  expiry: number; // unix seconds
  createdAt: number;
}

// In-memory mandate store. A mandate lives for one run (30-min expiry); an append-only
// DB row would be a drop-in upgrade, but the SECURITY property (cap can't be exceeded)
// is enforced here regardless of persistence.
const mandates = new Map<string, StoredMandate>();
// Nonces we've ever accepted — replay protection. A signature can be registered once.
const usedNonces = new Set<string>();

const USDC_UNITS = (usdc: number): bigint => BigInt(Math.round(usdc * 1e6));
const nowSec = () => Math.floor(Date.now() / 1000);

/**
 * Verify a browser-signed SpendingAuthorization and register it.
 * Throws (with a human-readable message) on ANY failure so the API can 4xx.
 * Returns the mandate id the client must attach to every /pay/settle for this run.
 */
export async function registerAuthorization(
  auth: SignedAuthorization,
): Promise<{ id: string; user: string; capUsdc: number; expiry: number }> {
  // --- shape checks ---------------------------------------------------------
  if (!auth || typeof auth !== "object") throw new Error("authorization payload missing");
  if (!/^0x[a-fA-F0-9]{40}$/.test(auth.user ?? "")) throw new Error("user must be a 0x address");
  if (!/^0x[a-fA-F0-9]{130}$/.test(auth.signature ?? "")) throw new Error("signature malformed");
  if (typeof auth.nonce !== "string" || !auth.nonce) throw new Error("nonce required");

  const capUnits = BigInt(auth.cap);
  if (capUnits <= 0n) throw new Error("cap must be positive");

  // --- domain / token binding ----------------------------------------------
  // The signature is bound to Arc testnet + the USDC token. A signature for any other
  // chain or token simply will not recover to the claimed signer against our domain.
  if (getAddress(auth.token) !== getAddress(ARC.USDC)) {
    throw new Error("authorization token is not Arc USDC");
  }

  // --- expiry ---------------------------------------------------------------
  if (typeof auth.expiry !== "number" || auth.expiry <= nowSec()) {
    throw new Error("authorization is expired");
  }

  // --- replay protection ----------------------------------------------------
  if (usedNonces.has(auth.nonce)) throw new Error("nonce already used (replay rejected)");

  // --- signature verification (ecrecover) -----------------------------------
  // verifyTypedData recomputes the EIP-712 digest over our domain+types and checks the
  // signature recovers to `auth.user`. If the caller lied about the signer, cap, token,
  // chainId, nonce or expiry, the digest changes and this returns false.
  const valid = await verifyTypedData({
    address: getAddress(auth.user),
    domain: DOMAIN,
    types: TYPES,
    primaryType: "SpendingAuthorization",
    message: {
      user: getAddress(auth.user),
      token: getAddress(auth.token),
      cap: capUnits,
      nonce: auth.nonce,
      expiry: BigInt(auth.expiry),
    },
    signature: auth.signature,
  });
  if (!valid) throw new Error("signature does not match the claimed wallet");

  // --- commit ---------------------------------------------------------------
  usedNonces.add(auth.nonce);
  const id = randomUUID();
  mandates.set(id, {
    id,
    user: getAddress(auth.user),
    capUnits,
    spentUnits: 0n,
    nonce: auth.nonce,
    expiry: auth.expiry,
    createdAt: nowSec(),
  });

  return {
    id,
    user: getAddress(auth.user),
    capUsdc: Number(formatUnits(capUnits, 6)),
    expiry: auth.expiry,
  };
}

export interface SpendResult {
  ok: boolean;
  error?: string;
  remainingUsdc?: number;
  spentUsdc?: number;
  capUsdc?: number;
}

/**
 * Gate + debit a single payment against a mandate. Call this BEFORE the paymaster pays.
 * Atomic: if the payment would push cumulative spend over the signed cap, it rejects and
 * debits nothing. On success it reserves the amount so concurrent buys can't both slip
 * under the cap.
 */
export function authorizeSpend(mandateId: string, amountUsdc: number): SpendResult {
  const m = mandates.get(mandateId);
  if (!m) return { ok: false, error: "unknown or missing spending authorization" };
  if (m.expiry <= nowSec()) {
    return { ok: false, error: "spending authorization expired" };
  }
  if (!(amountUsdc > 0) || !Number.isFinite(amountUsdc)) {
    return { ok: false, error: "invalid payment amount" };
  }
  const amountUnits = USDC_UNITS(amountUsdc);
  const wouldBe = m.spentUnits + amountUnits;
  if (wouldBe > m.capUnits) {
    return {
      ok: false,
      error: `payment of $${amountUsdc} would exceed signed cap $${Number(
        formatUnits(m.capUnits, 6),
      )} (already spent $${Number(formatUnits(m.spentUnits, 6))})`,
      spentUsdc: Number(formatUnits(m.spentUnits, 6)),
      capUsdc: Number(formatUnits(m.capUnits, 6)),
      remainingUsdc: Number(formatUnits(m.capUnits - m.spentUnits, 6)),
    };
  }
  // Reserve/debit now — the cap is a running ledger, not a per-call check.
  m.spentUnits = wouldBe;
  return {
    ok: true,
    spentUsdc: Number(formatUnits(m.spentUnits, 6)),
    capUsdc: Number(formatUnits(m.capUnits, 6)),
    remainingUsdc: Number(formatUnits(m.capUnits - m.spentUnits, 6)),
  };
}

/** Refund a reservation if the actual settlement failed AFTER we debited. */
export function refundSpend(mandateId: string, amountUsdc: number): void {
  const m = mandates.get(mandateId);
  if (!m) return;
  const amountUnits = USDC_UNITS(amountUsdc);
  m.spentUnits = m.spentUnits - amountUnits > 0n ? m.spentUnits - amountUnits : 0n;
}

/** Read-only view for the API / debugging. */
export function getMandate(mandateId: string): StoredMandate | undefined {
  return mandates.get(mandateId);
}
