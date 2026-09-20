import Link from "next/link";
import { getPointsByDraftClass, getAllTimeRiderRanking, fullName } from "@/lib/queries";
import { DraftClassChart } from "@/components/DraftClassChart";
import { TeamJersey } from "@/components/TeamJersey";
import { Flag } from "@/components/Flag";

const VIEWS = [
  { key: "draft-classes", label: "Points par classe de draft" },
  { key: "all-time", label: "Classement all-time" },
] as const;

export default async function StatistiquesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: viewParam } = await searchParams;
  const view = VIEWS.some((v) => v.key === viewParam) ? viewParam : "draft-classes";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Statistiques</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link key={v.key} href={`/statistiques?view=${v.key}`} className={`btn ${view === v.key ? "btn-primary" : ""}`}>
            {v.label}
          </Link>
        ))}
      </div>

      {view === "draft-classes" ? <DraftClassesSection /> : <AllTimeRankingSection />}
    </div>
  );
}

async function DraftClassesSection() {
  const { seasons, classes, points } = await getPointsByDraftClass();

  return (
    <>
      <p className="text-sm text-[var(--text-dim)]">
        Points inscrits par classe de draft, saison par saison. Les coureurs déjà présents en base en saison 1
        forment la classe S0 ; les coureurs de la draft de la saison N forment la classe SN.
      </p>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Points par classe de draft</h2>
        <DraftClassChart seasons={seasons} classes={classes} points={points} />
      </section>
    </>
  );
}

async function AllTimeRankingSection() {
  const ranking = await getAllTimeRiderRanking();

  return (
    <>
      <p className="text-sm text-[var(--text-dim)]">
        Classement all-time des points cumulés en carrière, toutes saisons confondues.
      </p>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Classement all-time — points cumulés</h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)] text-xs uppercase text-[var(--text-dim)]">
              <tr>
                <th className="px-4 py-3 text-left align-middle">#</th>
                <th className="px-4 py-3 text-left align-middle">Coureur</th>
                <th className="px-4 py-3 text-left align-middle">Activité</th>
                <th className="px-4 py-3 text-left align-middle">Équipes</th>
                <th className="w-28 px-4 py-3 text-right align-middle">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {ranking.map((r, i) => (
                <tr key={r.rider.id} className="group bg-[var(--surface)] transition-colors duration-200 hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-3 align-middle text-[var(--text-dim)]">{i + 1}</td>
                  <td className="px-4 py-3 align-middle">
                    <Link href={`/riders/${r.rider.id}`} className="inline-flex items-center gap-2 hover:text-[var(--accent)]">
                      <Flag nationality={r.rider.nationality} className="inline-block h-3.5 w-5 shrink-0 rounded-sm object-cover" />
                      {fullName(r.rider)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap text-[var(--text-dim)]">
                    S{r.rider.draftSeason} → {r.rider.retirementSeason != null ? `S${r.rider.retirementSeason}` : "actif"}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-1">
                      {r.teams.map((team) => (
                        <Link key={team.id} href={`/teams/${team.id}`} title={team.name}>
                          <TeamJersey jerseyUrl={team.jerseyUrl} color={team.color} className="h-6 w-6 rounded transition-transform duration-200 hover:scale-125" />
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right align-middle font-mono">{r.points}</td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-dim)]">
                    Aucun résultat enregistré pour l&apos;instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
