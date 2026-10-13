"use client";

import { motion } from "framer-motion";
import type { SynthEvent, PayEvent } from "@/lib/useAgentRun";
import { fmtUsd } from "@/lib/api";

/**
 * A thermal-printer style receipt that "prints out" when the run completes.
 * It turns the abstract run summary into a tangible artifact the user wants
 * to screenshot — the shareable moment.
 */
export function Receipt({
  synth,
  payments,
  taskId,
}: {
  synth: SynthEvent;
  payments: PayEvent[];
  taskId: string;
}) {
  const now = new Date();
  const testnetSettlements = payments.filter(
    (payment) => payment.provenance === "arc_testnet_x402",
  );
  const demoEvents = payments.filter(
    (payment) => payment.provenance === "demo_test_settlement",
  );
  const paymentIntents = payments.filter(
    (payment) => payment.provenance === "payment_intent",
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotateX: -8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="mx-auto w-full max-w-sm"
      style={{ perspective: 800 }}
    >
      <div className="relative bg-[#fafaf5] font-mono text-[11px] leading-relaxed text-neutral-800 shadow-2xl">
        <div className="px-5 pt-5 pb-4">
          <div className="text-center">
            <div className="text-base font-bold tracking-[0.2em] text-neutral-900">
              🧪 ASSAY
            </div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">
              payment-stage receipt
            </div>
          </div>

          <div className="my-3 border-t border-dashed border-neutral-400" />

          <div className="flex justify-between text-neutral-500">
            <span>task</span>
            <span className="text-neutral-800">{taskId.slice(0, 12) || "—"}</span>
          </div>
          <div className="flex justify-between text-neutral-500">
            <span>date</span>
            <span className="text-neutral-800">{now.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-neutral-500">
            <span>network</span>
            <span className="text-neutral-800">Arc testnet / demo</span>
          </div>

          <div className="my-3 border-t border-dashed border-neutral-400" />

          <div className="space-y-1">
            {payments.length === 0 && (
              <div className="text-center text-neutral-400">— no payment-stage records —</div>
            )}
            {payments.map((p, i) => (
              <div key={i} className="space-y-0.5">
                <div className="flex justify-between gap-2">
                  <span className="truncate text-neutral-700">
                    {p.title || p.creator || p.sourceId?.slice(0, 8)}
                  </span>
                  <span className="shrink-0 text-neutral-900">
                    {fmtUsd(p.amount ?? p.price ?? 0)}
                  </span>
                </div>
                <div className="text-[8px] uppercase tracking-wide text-neutral-400">
                  {p.provenance === "arc_testnet_x402"
                    ? "Arc testnet x402 settlement"
                    : p.provenance === "payment_intent"
                      ? "payment intent — not charged"
                      : "demo/test — not a real settlement"}
                </div>
              </div>
            ))}
          </div>

          <div className="my-3 border-t border-dashed border-neutral-400" />

          <div className="flex justify-between font-bold text-neutral-900">
            <span>PAYMENT-STAGE TOTAL</span>
            <span>{fmtUsd(synth.cost)}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px] text-neutral-500">
            <div>
              <div className="text-sm font-bold text-emerald-700">{synth.bought}</div>
              bought
            </div>
            <div>
              <div className="text-sm font-bold text-rose-700">{synth.skipped}</div>
              refused
            </div>
            <div>
              <div className="text-sm font-bold text-sky-700">{synth.cached}</div>
              cached
            </div>
          </div>

          <div className="my-3 border-t border-dashed border-neutral-400" />

          <div className="text-center text-[9px] text-neutral-500">
            {testnetSettlements.length} testnet settlement(s) · {demoEvents.length} demo/test
            event(s) · {paymentIntents.length} intent(s)
          </div>
          <div className="mt-2 text-center text-[8px] tracking-[0.3em] text-neutral-400">
            ▐▌▐▐▌▐▌▐▐▌▐▌▐▌▐▐▌▐▌▐▐▌▐▌▐▌▐▐▌
          </div>
          <div className="text-center text-[9px] text-neutral-600">
            payment events and settlement proofs are labelled separately
          </div>
        </div>
        {/* torn bottom edge */}
        <div className="receipt-edge text-[#fafaf5]" />
      </div>
    </motion.div>
  );
}
