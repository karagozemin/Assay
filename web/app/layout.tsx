import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Assay — the spending brain for research agents",
  description:
    "Assay decides which creator sources are worth buying, then pays them per use over x402 on Arc.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-mono antialiased">
        <div className="border-b border-edge bg-panel/60 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-2 text-center text-xs text-gray-300">
            <span className="text-accent">Assay</span> — the spending brain for
            research agents. It decides which creator sources are worth buying,
            then pays them per use over x402 on Arc.
          </div>
        </div>
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
