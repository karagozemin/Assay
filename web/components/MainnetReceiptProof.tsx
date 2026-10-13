"use client";

import { useState } from "react";
import {
  anchorRunReceipt,
  createRunReceipt,
  receiptArtifactUrl,
  type RunReceiptProof,
} from "@/lib/api";
import { sendMainnetReceiptAnchor } from "@/lib/wallet";

export function MainnetReceiptProof({
  taskId,
  authorizationId,
}: {
  taskId: string;
  authorizationId: string;
}) {
  const [receipt, setReceipt] = useState<RunReceiptProof | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAndAnchor = async () => {
    setWorking(true);
    setError(null);
    try {
      const prepared = receipt ?? (await createRunReceipt(taskId, authorizationId));
      setReceipt(prepared);
      if (prepared.anchorStatus === "verified") return;
      const hash = txHash ?? (await sendMainnetReceiptAnchor(prepared.signer, prepared.expectedCalldata));
      setTxHash(hash);
      const verified = await anchorRunReceipt(prepared.receiptId, hash);
      setReceipt(verified);
    } catch (cause: any) {
      setError(cause?.message ?? "Failed to create Arc mainnet receipt proof.");
    } finally {
      setWorking(false);
    }
  };

  const artifactUrl = receipt ? receiptArtifactUrl(receipt) : null;
  const verified = receipt?.anchorStatus === "verified";

  return (
    <div className={`glass space-y-3 p-4 ${verified ? "border-buy/40" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">
            {verified ? "Run receipt anchored on Arc mainnet" : "Arc mainnet run receipt"}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            Proves the completed run receipt and decision ledger. It is not proof of
            creator payment settlement.
          </p>
        </div>
        <span className={`pill ${verified ? "bg-buy/15 text-buy" : "bg-white/5 text-gray-400"}`}>
          {verified ? "verified" : "not anchored"}
        </span>
      </div>

      {receipt && (
        <div className="space-y-1 rounded-lg border border-edge bg-black/20 p-2 font-mono text-[10px] text-gray-500">
          <div className="break-all">receipt {receipt.receiptHash}</div>
          <div>chain {receipt.chainId} · signer {receipt.signer.slice(0, 10)}…</div>
          {receipt.blockNumber && <div>block {receipt.blockNumber}</div>}
        </div>
      )}

      {verified && receipt?.explorerUrl ? (
        <div className="flex flex-wrap gap-2">
          <a
            className="btn"
            href={receipt.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Arc explorer ↗
          </a>
          {artifactUrl && (
            <a className="btn-ghost" href={artifactUrl} target="_blank" rel="noopener noreferrer">
              Receipt artifact
            </a>
          )}
        </div>
      ) : (
        <button className="btn w-full" disabled={working} onClick={createAndAnchor}>
          {working
            ? txHash
              ? "Verifying on Arc mainnet…"
              : "Awaiting wallet…"
            : txHash
              ? "Retry Arc mainnet verification"
              : "Create Arc mainnet receipt proof"}
        </button>
      )}

      {txHash && !verified && (
        <div className="break-all font-mono text-[10px] text-gray-600">tx {txHash}</div>
      )}
      {error && <p className="text-xs text-skip">{error}</p>}
    </div>
  );
}
