"use client";

import { Odometer } from "./Odometer";
import { fmtUsd } from "@/lib/api";

/**
 * Radial budget gauge — the agent's "wallet" draining in real time.
 * The arc fills as USDC is committed; color shifts green→amber→red as the
 * agent approaches its ceiling.
 */
export function BudgetGauge({
  spent,
  budget,
}: {
  spent: number;
  budget: number;
}) {
  const pct = budget > 0 ? Math.min(1, spent / budget) : 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = C * pct;

  const color =
    pct < 0.6 ? "#22c55e" : pct < 0.9 ? "#fbbf24" : "#fb7185";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          style={{
            transition: "stroke-dasharray .6s cubic-bezier(.22,1,.36,1), stroke .4s",
            filter: `drop-shadow(0 0 6px ${color}88)`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <Odometer
          value={spent}
          format={(n) => fmtUsd(n)}
          className="font-display text-lg font-bold text-white"
        />
        <span className="text-[10px] uppercase tracking-[0.15em] text-gray-500">
          of {fmtUsd(budget)}
        </span>
        <span
          className="mt-0.5 text-[10px] font-semibold"
          style={{ color }}
        >
          {Math.round(pct * 100)}% committed
        </span>
      </div>
    </div>
  );
}
