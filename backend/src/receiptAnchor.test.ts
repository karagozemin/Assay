import assert from "node:assert/strict";
import test from "node:test";
import { verifyReceiptAnchor, type ReceiptAnchorRpc } from "./receiptAnchor.ts";

const signer = "0x1111111111111111111111111111111111111111";
const txHash = `0x${"ab".repeat(32)}`;
const expectedCalldata = `0x${"12".repeat(40)}`;

function rpc(overrides: {
  chainId?: number;
  from?: string;
  to?: string | null;
  input?: string;
  value?: bigint;
  txChainId?: number | null;
  status?: "success" | "reverted";
  unmined?: boolean;
} = {}): ReceiptAnchorRpc {
  return {
    async getChainId() {
      return overrides.chainId ?? 5042;
    },
    async getTransaction() {
      return {
        from: overrides.from ?? signer,
        to: overrides.to === undefined ? signer : overrides.to,
        input: overrides.input ?? expectedCalldata,
        value: overrides.value ?? 0n,
        chainId: overrides.txChainId === undefined ? 5042 : overrides.txChainId,
      };
    },
    async waitForTransactionReceipt() {
      if (overrides.unmined) throw new Error("timeout");
      return { status: overrides.status ?? "success", blockNumber: 42n };
    },
  };
}

const verify = (client: ReceiptAnchorRpc) =>
  verifyReceiptAnchor({ client, txHash, signer, expectedCalldata });

test("accepts a mined successful zero-value Arc mainnet self-transaction", async () => {
  const result = await verify(rpc());
  assert.deepEqual(result, { txHash, blockNumber: "42", chainId: 5042 });
});

test("rejects wrong chain ID", async () => {
  await assert.rejects(verify(rpc({ chainId: 5042002 })), /wrong chain ID/);
});

test("rejects wrong from address", async () => {
  await assert.rejects(
    verify(rpc({ from: "0x2222222222222222222222222222222222222222" })),
    /sender does not match/,
  );
});

test("rejects wrong to address", async () => {
  await assert.rejects(
    verify(rpc({ to: "0x2222222222222222222222222222222222222222" })),
    /must be a self-transaction/,
  );
});

test("rejects non-zero value", async () => {
  await assert.rejects(verify(rpc({ value: 1n })), /value must be zero/);
});

test("rejects wrong calldata", async () => {
  await assert.rejects(verify(rpc({ input: "0x1234" })), /calldata does not match/);
});

test("rejects failed transaction", async () => {
  await assert.rejects(verify(rpc({ status: "reverted" })), /reverted/);
});

test("rejects unmined transaction", async () => {
  await assert.rejects(verify(rpc({ unmined: true })), /not mined yet/);
});
