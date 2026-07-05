/**
 * PROOF: the signed spending-cap mandate is enforced server-side.
 *
 * This script signs REAL EIP-712 SpendingAuthorizations with a throwaway viem wallet
 * and drives the ACTUAL enforcement code in mandate.ts. No server, no funded wallet,
 * no real USDC — it proves the cryptographic + accounting chokepoint in isolation.
 *
 * Run:  node --experimental-transform-types --no-warnings src/mandate.proof.ts
 *
 * It asserts three attacks are refused and one honest spend succeeds:
 *   TEST 1  unknown / unsigned mandate id            → REJECTED
 *   TEST 2  spend that exceeds the signed cap         → REJECTED (paymaster never runs)
 *   TEST 3  expired mandate                           → REJECTED
 *   TEST 4  honest spend within cap                   → ALLOWED, ledger debits correctly
 * Plus:    a tampered cap (signature/message mismatch) fails registration.
 */
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { getAddress, parseUnits } from "viem";
import { ARC } from "./arc.ts";
import {
  registerAuthorization,
  authorizeSpend,
  type SignedAuthorization,
} from "./mandate.ts";

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

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ✅ PASS  ${label}${detail ? `  — ${detail}` : ""}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL  ${label}${detail ? `  — ${detail}` : ""}`);
    failed++;
  }
}

/** Sign a real EIP-712 SpendingAuthorization for the given cap (USDC) + expiry. */
async function signAuth(
  account: ReturnType<typeof privateKeyToAccount>,
  capUsdc: string,
  expiry: number,
  nonce: string,
): Promise<SignedAuthorization> {
  const capUnits = parseUnits(capUsdc, 6);
  const message = {
    user: getAddress(account.address),
    token: getAddress(ARC.USDC),
    cap: capUnits,
    nonce,
    expiry: BigInt(expiry),
  };
  const signature = await account.signTypedData({
    domain: DOMAIN,
    types: TYPES,
    primaryType: "SpendingAuthorization",
    message,
  });
  return {
    user: message.user,
    token: message.token,
    cap: capUnits.toString(),
    nonce,
    expiry,
    signature,
  };
}

async function main() {
  const account = privateKeyToAccount(generatePrivateKey());
  const nowSec = Math.floor(Date.now() / 1000);
  console.log(`\nBuyer wallet: ${account.address}`);
  console.log(`Signing real EIP-712 mandates bound to Arc testnet (chainId ${ARC.CHAIN_ID}).\n`);

  /* ------------------------------------------------------------------ *
   * TEST 1 — a payment with NO valid mandate id is refused.
   * ------------------------------------------------------------------ */
  console.log("TEST 1 — unauthorized: spend against an unknown/unsigned mandate");
  const r1 = authorizeSpend("not-a-real-mandate-id", 0.01);
  check("payment without a valid signed mandate is rejected", r1.ok === false, r1.error);

  /* ------------------------------------------------------------------ *
   * TEST 2 — register a real $0.02 mandate, then try to overspend it.
   * ------------------------------------------------------------------ */
  console.log("\nTEST 2 — over-cap: signed cap $0.02, attempt to spend past it");
  const auth2 = await signAuth(account, "0.02", nowSec + 1800, `nonce-${crypto.randomUUID()}`);
  const reg2 = await registerAuthorization(auth2);
  check("real signed mandate registers", Boolean(reg2.id), `id=${reg2.id} cap=$${reg2.capUsdc}`);

  const a = authorizeSpend(reg2.id, 0.015); // ok: 0.015 <= 0.02
  check("first spend $0.015 within cap is allowed", a.ok === true, `remaining $${a.remainingUsdc}`);

  const b = authorizeSpend(reg2.id, 0.01); // 0.015 + 0.01 = 0.025 > 0.02 → refuse
  check("second spend $0.010 that exceeds cap is REJECTED", b.ok === false, b.error);
  check("ledger did NOT debit the rejected spend", b.spentUsdc === 0.015, `still spent $${b.spentUsdc}`);

  /* ------------------------------------------------------------------ *
   * TEST 3 — an expired mandate cannot spend.
   * ------------------------------------------------------------------ */
  console.log("\nTEST 3 — expired: mandate whose expiry is in the past");
  // Register a mandate that is valid now, then prove authorizeSpend rejects once expired.
  // We sign with an expiry 2s out, register it, then wait it out.
  const auth3 = await signAuth(account, "1.00", nowSec + 2, `nonce-${crypto.randomUUID()}`);
  const reg3 = await registerAuthorization(auth3);
  check("short-lived mandate registers", Boolean(reg3.id));
  console.log("  … waiting for the mandate to expire …");
  await new Promise((r) => setTimeout(r, 2500));
  const c = authorizeSpend(reg3.id, 0.01);
  check("spend after expiry is REJECTED", c.ok === false, c.error);

  // And an already-expired signature can't even be registered.
  const authPast = await signAuth(account, "1.00", nowSec - 10, `nonce-${crypto.randomUUID()}`);
  let regThrew = false;
  let regErr = "";
  try {
    await registerAuthorization(authPast);
  } catch (e: any) {
    regThrew = true;
    regErr = e?.message ?? "";
  }
  check("registering an already-expired signature throws", regThrew, regErr);

  /* ------------------------------------------------------------------ *
   * TAMPER — flip the cap after signing; signature must fail to recover.
   * ------------------------------------------------------------------ */
  console.log("\nTAMPER — sign $0.02 but submit cap=$100 (message/signature mismatch)");
  const authT = await signAuth(account, "0.02", nowSec + 1800, `nonce-${crypto.randomUUID()}`);
  const tampered: SignedAuthorization = { ...authT, cap: parseUnits("100", 6).toString() };
  let tamperThrew = false;
  let tamperErr = "";
  try {
    await registerAuthorization(tampered);
  } catch (e: any) {
    tamperThrew = true;
    tamperErr = e?.message ?? "";
  }
  check("tampered cap fails signature verification", tamperThrew, tamperErr);

  /* ------------------------------------------------------------------ *
   * TEST 4 — honest path: a spend within the signed cap succeeds.
   * ------------------------------------------------------------------ */
  console.log("\nTEST 4 — honest: spend within the signed cap is allowed and debited");
  const auth4 = await signAuth(account, "0.05", nowSec + 1800, `nonce-${crypto.randomUUID()}`);
  const reg4 = await registerAuthorization(auth4);
  const d1 = authorizeSpend(reg4.id, 0.02);
  const d2 = authorizeSpend(reg4.id, 0.02);
  check("two honest sub-cap spends both allowed", d1.ok && d2.ok, `spent $${d2.spentUsdc} / $${d2.capUsdc}`);
  const d3 = authorizeSpend(reg4.id, 0.02); // 0.06 > 0.05 → refuse the third
  check("third spend that would cross cap is refused", d3.ok === false, d3.error);

  /* ------------------------------------------------------------------ */
  console.log(`\n──────────────────────────────────────────────`);
  console.log(`  RESULT: ${passed} passed, ${failed} failed`);
  console.log(`──────────────────────────────────────────────\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("proof harness crashed:", e);
  process.exit(1);
});
