import { Nav } from "@/components/Nav";
import { IntroOverlay } from "@/components/IntroOverlay";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="bg-console" aria-hidden />
      <IntroOverlay />
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6">
        <div className="flex items-center justify-between border-t border-white/[0.05] pt-4 text-[11px] text-zinc-600">
          <span>Assay — every purchase justified, every refusal explained.</span>
          <span className="font-mono">x402 · USDC · Arc</span>
        </div>
      </footer>
    </>
  );
}
