import type { Metadata } from "next";
import { Oswald, Caveat } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { isAdmin } from "@/lib/session";
import { logout } from "@/lib/authActions";

const oswald = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const caveat = Caveat({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-hand" });

export const metadata: Metadata = {
  title: "L'ère des Superligues",
  description: "Race results, rankings, calendar and rider histories",
};

// Every page here needs a live DB read (cookies via isAdmin() already make most of
// them dynamic, but Next still executes each page once at build time to detect that,
// which means hitting Turso during the build itself — if that connection is slow or
// flaky, the build hangs and times out (as happened on /teams). Force dynamic
// rendering site-wide so no page is ever touched at build time.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/", label: "Tableau de bord" },
  { href: "/riders", label: "Coureurs" },
  { href: "/teams", label: "Équipes" },
  { href: "/races", label: "Calendrier" },
  { href: "/rankings", label: "Classement" },
  { href: "/draft", label: "Draft" },
  { href: "/training", label: "Entraînement" },
  { href: "/statistiques", label: "Statistiques" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();

  return (
    <html lang="en" className={`${oswald.variable} ${caveat.variable}`}>
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen">
          <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6">
            <Link href="/" className="mb-8 block text-lg font-bold tracking-tight text-[var(--accent)]">
              🚴 L&apos;ère des Superligues
            </Link>
            <nav className="flex flex-1 flex-col gap-1">
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
            {admin ? (
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  Déconnexion
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                Connexion admin
              </Link>
            )}
          </aside>
          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
