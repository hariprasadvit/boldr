import { Link, NavLink, Outlet } from "react-router-dom";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/live", label: "Live pipeline" },
  { to: "/inbox", label: "Inbox" },
  { to: "/gaps", label: "Gaps" },
  { to: "/themes", label: "Themes" },
  { to: "/campaigns", label: "Campaigns" },
  { to: "/brief", label: "Marketing brief" },
  { to: "/bench", label: "External bench" },
];

export function App() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="block h-2 w-2 rounded-full bg-[var(--accent)]" />
            <span className="font-semibold tracking-tight">Boldr Intel Engine</span>
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[var(--muted)]">
              live
            </span>
          </Link>
          <nav className="flex flex-wrap justify-end gap-1 text-sm">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded px-2.5 py-1.5 ${isActive ? "text-zinc-100" : "text-zinc-400"} ` +
                  "transition-colors hover:bg-[var(--surface)] hover:text-zinc-100"
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-7xl px-6 pb-12 pt-4 text-xs text-[var(--muted)]">
        Boldr Supply Co. · Echelon 2026 AI Workflow Competition · self-improving CS pipeline
      </footer>
    </div>
  );
}
