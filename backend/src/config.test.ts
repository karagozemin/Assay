import assert from "node:assert/strict";
import test from "node:test";
import { loadBackendConfig } from "./config.ts";

const productionEnv = (): NodeJS.ProcessEnv => ({
  ASSAY_RUNTIME: "production",
  ASSAY_TEST_SETTLE: "0",
  ASSAY_MOCK_PAY: "0",
  CORS_ORIGIN: "https://assay-web.site,https://assay-web.vercel.app",
  ARC_MAINNET_CHAIN_ID: "5042",
  ARC_MAINNET_RPC_URL: "https://rpc.mainnet.arc.io",
  ARC_MAINNET_EXPLORER_URL: "https://explorer.arc.io",
});

test("production refuses ASSAY_TEST_SETTLE=1", () => {
  assert.throws(
    () => loadBackendConfig({ ...productionEnv(), ASSAY_TEST_SETTLE: "1" }),
    /forbidden in production/,
  );
});

test("production refuses ASSAY_MOCK_PAY=1", () => {
  assert.throws(
    () => loadBackendConfig({ ...productionEnv(), ASSAY_MOCK_PAY: "1" }),
    /forbidden in production/,
  );
});

test("production requires Arc mainnet config", () => {
  const env = productionEnv();
  delete env.ARC_MAINNET_RPC_URL;
  assert.throws(() => loadBackendConfig(env), /ARC_MAINNET_RPC_URL is required/);
});

test("production accepts the Arc mainnet boundary", () => {
  const config = loadBackendConfig(productionEnv());
  assert.equal(config.arcMainnet?.chainId, 5042);
  assert.deepEqual(config.corsOrigins, [
    "https://assay-web.site",
    "https://assay-web.vercel.app",
  ]);
});
