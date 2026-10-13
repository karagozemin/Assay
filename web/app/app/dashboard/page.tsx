"use client";

import { useEffect, useState } from "react";
import {
  getMetrics,
  getPayouts,
  getPayments,
  getDecisions,
  fmtUsd,
  type Metrics,
  type Payout,
  type Payment,
  type Decision,
} from "@/lib/api";
import { Odometer } from "@/components/Odometer";


export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);

  const refresh = () => {
    getMetrics().then(setMetrics).catch(() => {});
    getPayouts().then(setPayouts).catch(() => {});
    getPayments().then(setPayments).catch(() => {});
    getDecisions().then(setDecisions).catch(() => {});
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000); // live-ish polling
    return () => clearInterval(t);
  }, []);

  const skips = decisions.filter((d) => d.decision === "SKIP");
  const testnetPayments = payments.filter((p) => p.provenance === "arc_testnet_x402");

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-edge/70 bg-panel/40 px-6 py-8 backdrop-blur-xl sm:px-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-buy/15 blur-3xl" />
        <div className="relative">
          <span className="pill mb-3 border border-edge bg-white/5 text-gray-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-buy" />
            polling live · provenance-aware ledger
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            The ledger doesn't lie.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-gray-400">
            Demo/test payment events and Arc testnet x402 settlements are shown
            separately. Every refusal is logged with a rationale.
          </p>
        </div>
      </header>

      {/* live payment ticker */}
      {payments.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-edge/70 bg-black/40 py-2">
          <div className="flex w-max animate-marquee gap-8 whitespace-nowrap px-4 text-xs">
            {[...payments, ...payments].map((p, i) => (
              <span key={i} className="text-gray-400">
                <span className="text-buy">●</span> {fmtUsd(p.amount)}{" "}
                <span className="text-gray-600">→</span> creator{" "}
                {p.creatorId.slice(0, 6)}{" "}
                <span className="font-mono text-gray-600">{p.proof.slice(0, 10)}…</span>
                <span className="text-gray-600">
                  {p.provenance === "arc_testnet_x402"
                    ? "testnet x402"
                    : p.provenance === "payment_intent"
                      ? "intent · not charged"
                      : "demo/test"}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Big traction numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Big label="Testnet USDC settled" value={fmtUsd(metrics?.totalUsdc ?? 0)} />
        <Big label="Testnet x402 calls" num={metrics?.paidCalls ?? 0} />
        <Big label="Avg testnet settlement" value={fmtUsd(metrics?.avgPayment ?? 0)} />
        <Big label="Testnet creators paid" num={metrics?.uniqueCreatorsPaid ?? 0} />
        <Big label="Demo/test events" num={metrics?.demoPaymentEvents ?? 0} />
        <Big label="Payment intents" num={metrics?.paymentIntentEvents ?? 0} />
        <Big label="Unique tasks" num={metrics?.uniqueTasks ?? 0} />
        <Big label="Repeat tasks" num={metrics?.repeatTasks ?? 0} />
        <Big
          label="Buy / Skip ratio"
          value={(metrics?.buySkipRatio ?? 0).toFixed(2)}
        />
        <Big
          label="Buy · Skip · Cache"
          value={`${metrics?.buyCount ?? 0}·${metrics?.skipCount ?? 0}·${metrics?.cacheCount ?? 0}`}
        />
      </div>


      {/* Verified testnet payout ledger */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Verified Arc testnet x402 payouts
        </h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="pb-2">Creator</th>
                <th className="pb-2">Wallet</th>
                <th className="pb-2 text-right">Calls</th>
                <th className="pb-2 text-right">Testnet USDC</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-gray-500">
                    No payouts yet.
                  </td>
                </tr>
              )}
              {payouts.map((p) => (
                <tr key={p.creatorId} className="border-t border-edge">
                  <td className="py-2 text-white">{p.name}</td>
                  <td className="py-2 font-mono text-xs text-gray-400">
                    {p.walletAddress.slice(0, 10)}…{p.walletAddress.slice(-4)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{p.paidCalls}</td>
                  <td className="py-2 text-right tabular-nums text-emerald-300">
                    {fmtUsd(p.totalUsdc)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment-stage records */}
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Payment-stage records ({payments.length}; {testnetPayments.length} testnet proofs)
          </h2>
          <div className="card max-h-96 space-y-2 overflow-auto text-xs">
            {payments.length === 0 && <span className="text-gray-500">No payments yet.</span>}
            {payments
              .slice()
              .reverse()
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 border-b border-edge pb-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-emerald-300">{p.proof}</div>
                    <div className="text-gray-500">
                      {p.network} · {p.provenance === "arc_testnet_x402"
                        ? `testnet x402 · payer ${p.payer.slice(0, 8)}…`
                        : p.provenance === "payment_intent"
                          ? "payment intent — not charged or settled"
                          : "demo/test — not real settlement"}
                    </div>
                  </div>
                  <span className="tabular-nums text-white">{fmtUsd(p.amount)}</span>
                </div>
              ))}
          </div>
        </section>

        {/* Refusal log — the differentiator */}
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Refusal log ({skips.length}) — why the agent said no
          </h2>
          <div className="card max-h-96 space-y-2 overflow-auto text-xs">
            {skips.length === 0 && <span className="text-gray-500">No refusals yet.</span>}
            {skips
              .slice()
              .reverse()
              .map((d) => (
                <div key={d.id} className="border-b border-edge pb-2">
                  <div className="flex items-center justify-between">
                    <span className="pill bg-rose-500/20 text-rose-300">SKIP</span>
                    <span className="text-gray-500">
                      VoI {d.voi.toFixed(1)} · nov {d.novelty.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-1 text-gray-300">{d.rationale}</p>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Big({
  label,
  value,
  num,
}: {
  label: string;
  value?: string;
  num?: number;
}) {
  return (
    <div className="metric">
      <span className="metric-value text-accent">
        {num !== undefined ? <Odometer value={num} /> : value}
      </span>
      <span className="metric-label">{label}</span>
    </div>
  );
}
