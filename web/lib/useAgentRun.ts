"use client";

import { useCallback, useRef, useState } from "react";
import { AGENT } from "./api";

/**
 * Consumes the agent's POST /run Server-Sent-Events stream.
 * EventSource only supports GET, so we POST and parse the SSE frames off the
 * fetch ReadableStream by hand. Each frame is `event: <name>\ndata: <json>\n\n`.
 */

export type DecisionEvent = {
  taskId: string;
  sourceId: string;
  title: string;
  creator: string;
  decision: "BUY" | "SKIP" | "CACHE";
  reason: string;
  rationale: string;
  voi: number;
  relevance: number;
  novelty: number;
  expectedGain: number;
  price: number;
};

export type PayEvent = {
  sourceId: string;
  amount?: number;
  price?: number;
  proof?: string;
  creator?: string;
  payTo?: string;
  title?: string;
  error?: string;
};

export type SynthEvent = {
  answer: string;
  cost: number;
  creatorsPaid: number;
  bought: number;
  skipped: number;
  cached: number;
  buySkipRatio: number;
};

export type LogLine = { event: string; text: string; ts: number };

export type RunState = {
  running: boolean;
  taskId: string;
  discovered: number;
  priorPurchases: number;
  decisions: DecisionEvent[];
  payments: PayEvent[];
  synth: SynthEvent | null;
  log: LogLine[];
  error: string | null;
};

const INITIAL: RunState = {
  running: false,
  taskId: "",
  discovered: 0,
  priorPurchases: 0,
  decisions: [],
  payments: [],
  synth: null,
  log: [],
  error: null,
};

export function useAgentRun() {
  const [state, setState] = useState<RunState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (prompt: string, budget: number) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ ...INITIAL, running: true });

    const push = (event: string, text: string) =>
      setState((s) => ({
        ...s,
        log: [...s.log, { event, text, ts: Date.now() }],
      }));

    try {
      const res = await fetch(`${AGENT}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, budget }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`Agent responded ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handle = (event: string, data: any) => {
        switch (event) {
          case "intake":
            setState((s) => ({ ...s, taskId: data.taskId }));
            push("intake", `Task ${data.taskId?.slice(0, 8)} — budget $${data.budget}`);
            break;
          case "discover":
            setState((s) => ({
              ...s,
              discovered: data.count,
              priorPurchases: data.priorPurchases ?? 0,
            }));
            push(
              "discover",
              `Discovered ${data.count} candidate source(s); ${data.priorPurchases ?? 0} prior purchase(s) inform novelty.`,
            );
            break;
          case "decision":
            setState((s) => ({ ...s, decisions: [...s.decisions, data] }));
            break;
          case "pay_start":
            push("pay", `Paying ${data.title} → ${data.payTo?.slice(0, 10)}… ($${data.price})`);
            break;
          case "pay_done":
            setState((s) => ({ ...s, payments: [...s.payments, data] }));
            push("pay", `Settled $${data.amount} to ${data.creator} — proof ${String(data.proof).slice(0, 14)}…`);
            break;
          case "pay_error":
            push("error", `Payment failed for ${data.sourceId}: ${data.error}`);
            break;
          case "synthesize":
            setState((s) => ({ ...s, synth: data }));
            break;
          case "error":
            setState((s) => ({ ...s, error: data.message }));
            push("error", data.message);
            break;
          case "done":
            push("done", `Run complete — spent $${data.spent}`);
            break;
          default:
            break;
        }
      };

      // Read + parse the SSE stream frame-by-frame.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          let event = "message";
          let dataStr = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          if (!dataStr) continue;
          try {
            handle(event, JSON.parse(dataStr));
          } catch {
            /* ignore malformed frame */
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setState((s) => ({ ...s, error: e?.message ?? "Run failed" }));
      }
    } finally {
      setState((s) => ({ ...s, running: false }));
    }
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { state, run, reset };
}
