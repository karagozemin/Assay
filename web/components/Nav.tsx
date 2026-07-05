"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Agent Run" },
  { href: "/refusals", label: "Wall of No" },
  { href: "/creator", label: "Creator Studio" },
  { href: "/dashboard", label: "Ledger" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-30 border-b border-edge/70 bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3">
        <Link href="/" className="mr-4 flex items-center gap-2">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-sm shadow-glow">
            🧪
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            Assay
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.25em] text-gray-500 sm:inline">
            spending&nbsp;brain
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {links.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
                  active
                    ? "bg-gradient-to-b from-accent to-accent2 text-ink shadow-glow"
                    : "text-gray-400 hover:bg-panel hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
