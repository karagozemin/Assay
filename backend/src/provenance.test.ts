import assert from "node:assert/strict";
import test from "node:test";
import { classifyPaymentProvenance } from "./provenance.ts";

test("test settlement identifiers are always demo/test", () => {
  assert.equal(
    classifyPaymentProvenance(
      "test-settle-example",
      "arc_testnet_x402",
      "eip155:5042002",
    ),
    "demo_test_settlement",
  );
  assert.equal(
    classifyPaymentProvenance("0xmockexample", "arc_testnet_x402", "eip155:5042002"),
    "demo_test_settlement",
  );
});

test("unverified records remain payment intents", () => {
  assert.equal(
    classifyPaymentProvenance("opaque-id", undefined, "eip155:5042002"),
    "payment_intent",
  );
});
