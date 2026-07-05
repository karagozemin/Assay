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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Ledger &amp; Dashboard</h1>
        <p className="text-sm text-gray-400">
          Live traction. Every paid call is real testnet USDC settled on Arc; every
          refusal is logged with a rationale below.
        </p>
      </header>

      {/* Big traction numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Big label="Total USDC settled" value={fmtUsd(metrics?.totalUsdc ?? 0)} />
        <Big label="Paid calls" value={String(metrics?.paidCalls ?? 0)} />
        <Big label="Avg payment" value={fmtUsd(metrics?.avgPayment ?? 0)} />
        <Big label="Creators paid" value={String(metrics?.uniqueCreatorsPaid ?? 0)} />
        <Big label="Unique tasks" value={String(metrics?.uniqueTasks ?? 0)} />
        <Big label="Repeat tasks" value={String(metrics?.repeatTasks ?? 0)} />
        <Big
          label="Buy / Skip ratio"
          value={(metrics?.buySkipRatio ?? 0).toFixed(2)}
        />
        <Big
          label="Buy · Skip · Cache"
          value={`${metrics?.buyCount ?? 0}·${metrics?.skipCount ?? 0}·${metrics?.cacheCount ?? 0}`}
        />
      </div>

      {/* Payout ledger */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Per-creator payouts
        </h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="pb-2">Creator</th>
                <th className="pb-2">Wallet</th>
                <th className="pb-2 text-right">Calls</th>
                <th className="pb-2 text-right">Earned</th>
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
        {/* Payment proofs */}
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Payment proofs ({payments.length})
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
                      {p.network} · payer {p.payer.slice(0, 8)}…
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

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span className="metric-value text-accent">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}
