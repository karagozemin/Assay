"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated number that eases toward its target — the "counting up" effect that
 * makes stats feel alive. Uses requestAnimationFrame, no dependencies.
 */
export function Odometer({
  value,
  format,
  className = "",
  duration = 600,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    startRef.current = null;

    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return (
    <span className={`tabular-nums ${className}`}>
      {format ? format(display) : Math.round(display).toLocaleString()}
    </span>
  );
}
