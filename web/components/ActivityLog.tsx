"use client";

import { useEffect, useRef } from "react";
import type { LogLine } from "@/lib/useAgentRun";

const COLOR: Record<string, string> = {
  error: "text-skip",
  pay: "text-buy",
  decision: "text-accent",
  discover: "text-cache",
  synthesize: "text-accent2",
  done: "text-buy",
  intake: "text-gray-400",
};

/** A live "terminal" the agent narrates into — auto-scrolls to the newest line. */
export function ActivityLog({ log, running }: { log: LogLine[]; running: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log.length]);

  return (
    <div className="overflow-hidden rounded-2xl border border-edge/80 bg-black/50 backdrop-blur-xl">
      <div className="flex items-center gap-1.5 border-b border-edge/60 bg-white/[0.02] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-skip/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-buy/70" />
        <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-gray-500">
          agent.log
        </span>
        {running && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-buy">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-buy" />
            live
          </span>
        )}
      </div>
      <div className="max-h-72 space-y-0.5 overflow-auto p-3 text-[11px] leading-relaxed">
        {log.length === 0 && (
          <div className="text-gray-600">$ awaiting run…</div>
        )}
        {log.map((l, i) => (
          <div key={i} className="fade-up flex gap-2">
            <span className="shrink-0 text-gray-700">
              {new Date(l.ts).toLocaleTimeString([], { hour12: false })}
            </span>
            <span className={`shrink-0 font-semibold ${COLOR[l.event] ?? "text-gray-500"}`}>
              {l.event}
            </span>
            <span className="text-gray-300">{l.text}</span>
          </div>
        ))}
        {running && (
          <div className="flex gap-2">
            <span className="text-gray-700">
              {new Date().toLocaleTimeString([], { hour12: false })}
            </span>
            <span className="animate-pulse text-gray-500">▋</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
