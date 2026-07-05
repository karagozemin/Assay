"use client";

/**
 * Horizontal "flight path" of the agent's run: Intake → Discover → Assay →
 * Settle → Synthesize. Each phase lights up as the agent reaches it, giving the
 * viewer a mental model of what's happening under the hood.
 */
export type Phase = "idle" | "intake" | "discover" | "assay" | "settle" | "synthesize" | "done";

const ORDER: { key: Phase; label: string; icon: string }[] = [
  { key: "intake", label: "Intake", icon: "◎" },
  { key: "discover", label: "Discover", icon: "⌕" },
  { key: "assay", label: "Assay", icon: "🧪" },
  { key: "settle", label: "Settle", icon: "⛓" },
  { key: "synthesize", label: "Synthesize", icon: "✎" },
];

const RANK: Record<Phase, number> = {
  idle: -1,
  intake: 0,
  discover: 1,
  assay: 2,
  settle: 3,
  synthesize: 4,
  done: 5,
};

export function PhaseRail({ phase }: { phase: Phase }) {
  const rank = RANK[phase];
  return (
    <div className="glass flex items-center justify-between gap-1 px-3 py-3">
      {ORDER.map((p, i) => {
        const r = RANK[p.key];
        const done = rank > r;
        const active = rank === r;
        return (
          <div key={p.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm transition-all duration-500 ${
                  active
                    ? "border-accent bg-accent/20 text-white shadow-glow scale-110"
                    : done
                      ? "border-buy/60 bg-buy/10 text-buy"
                      : "border-edge bg-panel/60 text-gray-600"
                }`}
              >
                {done ? "✓" : p.icon}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  active ? "text-white" : done ? "text-buy/80" : "text-gray-600"
                }`}
              >
                {p.label}
              </span>
            </div>
            {i < ORDER.length - 1 && (
              <div className="mx-1 h-0.5 flex-1 overflow-hidden rounded-full bg-edge">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-buy to-accent transition-all duration-700"
                  style={{ width: rank > r ? "100%" : active ? "50%" : "0%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
