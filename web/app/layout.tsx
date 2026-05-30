import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boldr Intel Engine",
  description:
    "Self-improving customer intelligence engine for Boldr Supply Co. Every customer enquiry becomes drafted reply + knowledge base intelligence + marketing signal.",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/live", label: "Live pipeline" },
  { href: "/inbox", label: "Inbox" },
  { href: "/gaps", label: "Gaps" },
  { href: "/themes", label: "Themes" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/brief", label: "Marketing brief" },
  { href: "/bench", label: "External bench" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="block h-2 w-2 rounded-full bg-[var(--accent)]" />
              <span className="font-semibold tracking-tight">Boldr Intel Engine</span>
              <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[var(--muted)]">
                live
              </span>
            </Link>
            <nav className="flex flex-wrap justify-end gap-1 text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded px-2.5 py-1.5 text-zinc-400 transition-colors hover:bg-[var(--surface)] hover:text-zinc-100"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-7xl px-6 pb-12 pt-4 text-xs text-[var(--muted)]">
          Boldr Supply Co. · Echelon 2026 AI Workflow Competition · self-improving CS pipeline
        </footer>
      </body>
    </html>
  );
}
