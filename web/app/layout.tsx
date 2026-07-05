import "./globals.css";
import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import DarkVeil from "@/components/DarkVeil";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Assay — the spending brain for research agents",
  description:
    "Watch an AI agent decide which creator sources are worth buying — and why it refuses the rest — paying per use over x402 on Arc.",
  icons: {
    icon: "/assay.png",
    apple: "/assay.png",
  },
  openGraph: {
    title: "Assay — the spending brain for research agents",
    description:
      "An AI agent that decides which creator sources are worth buying — and refuses the rest — paying per use over x402 on Arc.",
    images: ["/assay.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <div className="bg-veil" aria-hidden>
          <DarkVeil hueShift={0} />
        </div>
        <div className="bg-grid" aria-hidden />
        <div className="bg-noise" aria-hidden />
        {children}
      </body>
    </html>
  );
}
