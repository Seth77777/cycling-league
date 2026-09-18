import Link from "next/link";
import { getTeamsOverview } from "@/lib/queries";
import { TeamJersey } from "@/components/TeamJersey";
import { StarRating } from "@/components/StarRating";
import { isAdmin } from "@/lib/session";

export default async function TeamsPage() {
  const teams = await getTeamsOverview();
  const admin = await isAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Équipes</h1>
        {admin && (
          <Link href="/teams/new" className="btn btn-primary">
            + Nouvelle équipe
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/teams/${team.id}`}
            className="group relative overflow-hidden rounded-lg border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:shadow-xl hover:shadow-black/30"
          >
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-[var(--accent)]/10 blur-3xl transition-all duration-300 group-hover:h-48 group-hover:w-48 group-hover:bg-[var(--accent)]/20" />
            <div aria-hidden className="pointer-events-none absolute -bottom-14 -left-10 h-40 w-40 rounded-full bg-[var(--accent-2)]/10 blur-3xl transition-all duration-300 group-hover:h-48 group-hover:w-48 group-hover:bg-[var(--accent-2)]/20" />
            <div className="relative flex flex-col items-center gap-3">
              <TeamJersey
                jerseyUrl={team.jerseyUrl}
                color={team.color}
                className="h-20 w-20 rounded-lg transition-transform duration-300 group-hover:scale-110"
              />
              <span className="text-lg font-semibold transition-transform duration-300 group-hover:scale-105">{team.name}</span>
              <StarRating value={team.reputation} glow wave className="text-lg" />
              <div className="text-xs text-[var(--text-dim)]">Manager : {team.manager ?? "—"}</div>
            </div>
          </Link>
        ))}
        {teams.length === 0 && <p className="text-sm text-[var(--text-dim)]">Aucune équipe pour le moment.</p>}
      </div>
    </div>
  );
}
