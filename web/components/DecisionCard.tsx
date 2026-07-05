import type { DecisionEvent } from "@/lib/useAgentRun";
import { fmtUsd } from "@/lib/api";

const STYLES: Record<string, { ring: string; pill: string; label: string; icon: string }> = {
  BUY: {
    ring: "border-emerald-500/50 bg-emerald-500/5",
    pill: "bg-emerald-500/20 text-emerald-300",
    label: "BOUGHT",
    icon: "✓",
  },
  SKIP: {
    ring: "border-rose-500/50 bg-rose-500/5",
    pill: "bg-rose-500/20 text-rose-300",
    label: "SKIPPED",
    icon: "✕",
  },
  CACHE: {
    ring: "border-sky-500/50 bg-sky-500/5",
    pill: "bg-sky-500/20 text-sky-300",
    label: "CACHE-HIT",
    icon: "♻",
  },
};

const Bar = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center gap-2">
    <span className="w-16 text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
      <div
        className="h-full rounded-full bg-accent/70"
        style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
      />
    </div>
    <span className="w-10 text-right text-[10px] tabular-nums text-gray-400">
      {value.toFixed(2)}
    </span>
  </div>
);

export function DecisionCard({ d }: { d: DecisionEvent }) {
  const st = STYLES[d.decision] ?? STYLES.SKIP;
  return (
    <div className={`fade-up rounded-xl border p-3 ${st.ring}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{d.title}</div>
          <div className="text-xs text-gray-400">
            {d.creator || "unknown creator"} · {fmtUsd(d.price)}
          </div>
        </div>
        <span className={`pill ${st.pill}`}>
          {st.icon} {st.label}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-gray-300">{d.rationale}</p>

      <div className="mt-3 grid gap-1">
        <Bar label="relevance" value={d.relevance} />
        <Bar label="novelty" value={d.novelty} />
        <Bar label="gain" value={d.expectedGain} />
      </div>
      <div className="mt-2 text-right text-[10px] text-gray-500">
        VoI <span className="tabular-nums text-gray-300">{d.voi}</span> /$ · reason:{" "}
        <span className="text-gray-400">{d.reason}</span>
      </div>
    </div>
  );
}
