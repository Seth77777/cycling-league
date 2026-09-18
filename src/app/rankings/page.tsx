import Link from "next/link";
import { getRiderRankings, getTeamRankings, getNationRankings, listSeasons, fullName } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { createCategory } from "@/lib/actions";
import { parsePointsByRank } from "@/lib/points";
import { Flag } from "@/components/Flag";
import { TeamJersey } from "@/components/TeamJersey";
import { isAdmin } from "@/lib/session";

function Scale({ label, values }: { label: string; values: number[] }) {
  return (
    <div className="mt-1">
      <div className="text-xs text-[var(--text-dim)]">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1 text-xs">
        {values.map((p, i) => (
          <span key={i} className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono">
            #{i + 1}: {p}
          </span>
        ))}
      </div>
    </div>
  );
}

async function BaremesTab() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const admin = await isAdmin();

  return (
    <div className={admin ? "grid grid-cols-2 gap-6" : undefined}>
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 font-semibold">Barèmes existants</h2>
        <div className="flex flex-col gap-3">
          {categories.map((c) => (
            <div key={c.id} className="rounded-md border border-[var(--border)] p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{c.name}</div>
                <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-dim)]">
                  {c.kind === "grand-tour" ? "Grand tour" : "Simple"}
                </span>
              </div>
              {c.kind === "grand-tour" ? (
                <>
                  <Scale label={`Étape (CLM ×${c.stageTtMultiplier})`} values={parsePointsByRank(c.stagePointsByRank ?? "[]")} />
                  <Scale label="Général" values={parsePointsByRank(c.generalPointsByRank ?? "[]")} />
                  {c.jerseyPointsByRank && <Scale label="Maillot distinctif" values={parsePointsByRank(c.jerseyPointsByRank)} />}
                </>
              ) : (
                <Scale label="Barème" values={parsePointsByRank(c.pointsByRank ?? "[]")} />
              )}
            </div>
          ))}
          {categories.length === 0 && <p className="text-sm text-[var(--text-dim)]">Aucun barème pour le moment.</p>}
        </div>
      </section>

      {admin && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 font-semibold">Nouveau barème</h2>
        <form action={createCategory} className="kind-form flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Nom
            <input name="name" required placeholder="ex. Classique" className="input" />
          </label>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="kind" value="simple" defaultChecked />
              Simple (course d&apos;un jour)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="kind" value="grand-tour" />
              Grand tour (par étapes)
            </label>
          </div>

          <div className="kind-simple flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Points par rang (séparés par des virgules, 1er en premier)
              <input name="points" placeholder="200,150,100,80,65,50,40,30,20,10" className="input" />
            </label>
          </div>

          <div className="kind-grand-tour flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Points d&apos;étape (1er en premier)
              <input name="stagePoints" placeholder="80,60,40,30,15" className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Multiplicateur CLM (contre-la-montre)
              <input name="stageTtMultiplier" type="number" min={1} defaultValue={1} className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Points au général (1er en premier)
              <input name="generalPoints" placeholder="400,300,230,200,150,120,100,70,50,30" className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Points de maillot distinctif (1er en premier, optionnel)
              <input name="jerseyPoints" placeholder="120,70,30" className="input" />
            </label>
          </div>

          <button type="submit" className="btn btn-primary mt-2">
            Créer le barème
          </button>
        </form>
        </section>
      )}
    </div>
  );
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; view?: string }>;
}) {
  const { season: seasonParam, view: viewParam } = await searchParams;
  const seasons = await listSeasons();
  const season = seasonParam === "all" ? undefined : seasonParam ? Number(seasonParam) : seasons[0];
  const view =
    viewParam === "team" ? "team" : viewParam === "nation" ? "nation" : viewParam === "baremes" ? "baremes" : "rider";

  const riderRankings = view === "rider" ? await getRiderRankings(season) : [];
  const teamRankings = view === "team" ? await getTeamRankings(season) : [];
  const nationRankings = view === "nation" ? await getNationRankings(season) : [];

  const seasonLink = (s?: number) =>
    `/rankings?view=${view}${s === undefined ? "&season=all" : `&season=${s}`}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Classement</h1>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Link href={`/rankings?view=rider${season !== undefined ? `&season=${season}` : "&season=all"}`} className={`btn ${view === "rider" ? "btn-primary" : ""}`}>
            Coureurs
          </Link>
          <Link href={`/rankings?view=team${season !== undefined ? `&season=${season}` : "&season=all"}`} className={`btn ${view === "team" ? "btn-primary" : ""}`}>
            Équipes
          </Link>
          <Link href={`/rankings?view=nation${season !== undefined ? `&season=${season}` : "&season=all"}`} className={`btn ${view === "nation" ? "btn-primary" : ""}`}>
            Nations
          </Link>
          <Link href="/rankings?view=baremes" className={`btn ${view === "baremes" ? "btn-primary" : ""}`}>
            Barèmes
          </Link>
        </div>
        {view !== "baremes" && (
          <div className="flex gap-2">
            <Link href={seasonLink(undefined)} className={`btn ${season === undefined ? "btn-primary" : ""}`}>
              All-time
            </Link>
            {seasons.map((s) => (
              <Link key={s} href={seasonLink(s)} className={`btn ${s === season ? "btn-primary" : ""}`}>
                {s}
              </Link>
            ))}
          </div>
        )}
      </div>

      {view === "baremes" ? (
        <BaremesTab />
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--text-dim)]">
              {view === "rider" ? (
                <tr>
                  <th className="w-14 px-4 py-3 align-middle">#</th>
                  <th className="px-4 py-3 align-middle">Coureur</th>
                  <th className="px-4 py-3 align-middle">Équipe</th>
                  <th className="w-28 px-4 py-3 text-right align-middle">Points</th>
                </tr>
              ) : (
                <tr>
                  <th className="w-14 px-4 py-3 align-middle">#</th>
                  <th className="px-4 py-3 align-middle">{view === "nation" ? "Nation" : "Équipe"}</th>
                  <th className="w-20 px-4 py-3 text-right align-middle">Victoires</th>
                  <th className="w-20 px-4 py-3 text-right align-middle">Podiums</th>
                  <th className="w-24 px-4 py-3 text-right align-middle">Points</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {view === "rider"
                ? riderRankings.map((r, i) => (
                    <tr key={r.rider.id} className="group bg-[var(--surface)] transition-colors duration-200 hover:bg-[var(--surface-2)]">
                      <td className="px-4 py-3 align-middle text-[var(--text-dim)]">{i + 1}</td>
                      <td className="px-4 py-3 align-middle">
                        <Link href={`/riders/${r.rider.id}`} className="inline-flex items-center gap-2 hover:text-[var(--accent)]">
                          <Flag nationality={r.rider.nationality} className="inline-block h-3.5 w-5 shrink-0 rounded-sm object-cover transition-transform duration-300 group-hover:scale-125" />
                          {fullName(r.rider)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {r.team ? (
                          <Link href={`/teams/${r.team.id}`} className="inline-flex items-center gap-2 text-[var(--text-dim)] hover:text-[var(--accent)]">
                            <TeamJersey jerseyUrl={r.team.jerseyUrl} color={r.team.color} className="h-8 w-8 rounded transition-transform duration-300 group-hover:scale-110" />
                            {r.team.name}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-[var(--text-dim)]">
                            <span className="h-8 w-8 shrink-0" aria-hidden />
                            Agent libre
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right align-middle font-mono">{r.points}</td>
                    </tr>
                  ))
                : view === "team"
                  ? teamRankings.map((r, i) => (
                      <tr key={r.team.id} className="group bg-[var(--surface)] transition-colors duration-200 hover:bg-[var(--surface-2)]">
                        <td className="px-4 py-3 align-middle text-[var(--text-dim)]">{i + 1}</td>
                        <td className="px-4 py-3 align-middle">
                          <Link href={`/teams/${r.team.id}`} className="inline-flex items-center gap-2 hover:text-[var(--accent)]">
                            <TeamJersey jerseyUrl={r.team.jerseyUrl} color={r.team.color} className="h-10 w-10 rounded transition-transform duration-300 group-hover:scale-110" />
                            {r.team.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right align-middle">{r.wins}</td>
                        <td className="px-4 py-3 text-right align-middle">{r.podiums}</td>
                        <td className="px-4 py-3 text-right align-middle font-mono">{r.points}</td>
                      </tr>
                    ))
                  : nationRankings.map((r, i) => (
                      <tr key={r.nationality} className="group bg-[var(--surface)] transition-colors duration-200 hover:bg-[var(--surface-2)]">
                        <td className="px-4 py-3 align-middle text-[var(--text-dim)]">{i + 1}</td>
                        <td className="px-4 py-3 align-middle">
                          <span className="inline-flex items-center gap-2">
                            <Flag nationality={r.nationality} className="inline-block h-3.5 w-5 shrink-0 rounded-sm object-cover transition-transform duration-300 group-hover:scale-125" />
                            {r.nationality}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right align-middle">{r.wins}</td>
                        <td className="px-4 py-3 text-right align-middle">{r.podiums}</td>
                        <td className="px-4 py-3 text-right align-middle font-mono">{r.points}</td>
                      </tr>
                    ))}
              {((view === "rider" && riderRankings.length === 0) ||
                (view === "team" && teamRankings.length === 0) ||
                (view === "nation" && nationRankings.length === 0)) && (
                <tr>
                  <td colSpan={view === "rider" ? 4 : 5} className="px-4 py-6 text-center text-[var(--text-dim)]">
                    Aucun résultat enregistré pour ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
