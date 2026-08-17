import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cycling League",
  description: "Race results, rankings, calendar and rider histories",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/riders", label: "Riders" },
  { href: "/teams", label: "Teams" },
  { href: "/races", label: "Calendar" },
  { href: "/rankings", label: "Rankings" },
  { href: "/categories", label: "Categories" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6">
            <Link href="/" className="mb-8 block text-lg font-bold tracking-tight text-[var(--accent)]">
              🚴 Cycling League
            </Link>
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
