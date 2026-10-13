const assert = require("node:assert/strict");
const test = require("node:test");
const { validateProductionEnv } = require("./validate-env.cjs");

test("production frontend rejects localhost", () => {
  assert.throws(
    () =>
      validateProductionEnv({
        NEXT_PUBLIC_BACKEND_URL: "http://localhost:4000",
        NEXT_PUBLIC_AGENT_URL: "https://assay-agent.onrender.com",
      }),
    /persistent production origin/,
  );
});

test("production frontend rejects trycloudflare", () => {
  assert.throws(
    () =>
      validateProductionEnv({
        NEXT_PUBLIC_BACKEND_URL: "https://temporary.trycloudflare.com",
        NEXT_PUBLIC_AGENT_URL: "https://assay-agent.onrender.com",
      }),
    /persistent production origin/,
  );
});

test("production frontend accepts persistent origins", () => {
  assert.deepEqual(
    validateProductionEnv({
      NEXT_PUBLIC_BACKEND_URL: "https://assay-backend.onrender.com",
      NEXT_PUBLIC_AGENT_URL: "https://assay-agent.onrender.com",
    }),
    {
      backendUrl: "https://assay-backend.onrender.com",
      agentUrl: "https://assay-agent.onrender.com",
    },
  );
});
