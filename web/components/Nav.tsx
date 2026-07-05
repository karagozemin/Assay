"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Agent Run" },
  { href: "/creator", label: "Creator" },
  { href: "/dashboard", label: "Ledger / Dashboard" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="border-b border-edge bg-ink/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3">
        <Link href="/" className="mr-4 text-lg font-bold text-white">
          🧪 Assay
        </Link>
        {links.map((l) => {
          const active = path === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                active
                  ? "bg-accent text-ink font-semibold"
                  : "text-gray-300 hover:bg-panel"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
