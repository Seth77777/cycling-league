import Link from "next/link";
import { getRaces, getLatestSeason, fullName } from "@/lib/queries";
import { generateSeasonCalendar } from "@/lib/actions";
import { GRAND_TOUR_STAGE_COUNT } from "@/lib/calendarTemplate";
import { Flag } from "@/components/Flag";
import { RaceLogo } from "@/components/RaceLogo";
import { TeamJersey } from "@/components/TeamJersey";
import { isAdmin } from "@/lib/session";

function classificationLabel(jerseyName: string | null) {
  return jerseyName ?? "Maillot";
}

export default async function RacesPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: seasonParam } = await searchParams;
  const latestSeason = await getLatestSeason();
  const season = seasonParam ? Number(seasonParam) : latestSeason;
  const seasons = Array.from({ length: latestSeason }, (_, i) => i + 1);
  const races = await getRaces(season);
  const admin = await isAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendrier</h1>
        {admin && (
          <Link href="/races/new" className="btn btn-primary">
            + Nouvelle course
          </Link>
        )}
      </div>

      <div className="flex gap-2">
        {seasons.map((s) => (
          <Link key={s} href={`/races?season=${s}`} className={`btn ${s === season ? "btn-primary" : ""}`}>
            {s}
          </Link>
        ))}
      </div>

      {races.length === 0 && admin && (
        <form action={generateSeasonCalendar} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <input type="hidden" name="season" value={season} />
          <p className="text-sm text-[var(--text-dim)]">
            Aucune course pour la saison {season}. Le calendrier est le même chaque année (22 courses, dont 3 grands
            tours générés avec leurs 21 étapes).
          </p>
          <button type="submit" className="btn btn-primary shrink-0">
            Générer le calendrier
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--text-dim)]">
            <tr>
              <th className="px-4 py-2">Course</th>
              <th className="px-4 py-2">Pays</th>
              <th className="px-4 py-2">Catégorie</th>
              <th className="px-4 py-2">Résultat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {races.map((race) => (
              <tr key={race.id} className="bg-[var(--surface)] hover:bg-[var(--surface-2)]">
                <td className="px-4 py-2">
                  <Link href={`/races/${race.id}`} className="inline-flex items-center gap-2 hover:text-[var(--accent)]">
                    <RaceLogo logoUrl={race.logoUrl} />
                    {race.order != null ? `${race.order}. ` : ""}
                    {race.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-[var(--text-dim)]">
                  {race.country ? (
                    <span className="inline-flex items-center gap-2">
                      <Flag nationality={race.country} />
                      {race.country}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2 text-[var(--text-dim)]">{race.category.name}</td>
                <td className="px-4 py-2 text-[var(--text-dim)]">
                  {race.category.kind === "grand-tour" ? (
                    (() => {
                      const stagesWithResults = race.children.filter(
                        (c) => c.resultKind === "stage" && c._count.results > 0,
                      ).length;
                      if (stagesWithResults < GRAND_TOUR_STAGE_COUNT) {
                        return (
                          <span>
                            Non-terminé ({stagesWithResults}/{GRAND_TOUR_STAGE_COUNT} étapes)
                          </span>
                        );
                      }

                      const jerseys = race.children.filter((c) => c.resultKind === "jersey");
                      const classifications = [
                        { label: "Général", winner: race.results[0] },
                        ...jerseys.map((j) => ({ label: classificationLabel(j.jerseyName), winner: j.results[0] })),
                      ];

                      return (
                        <div className="flex flex-col gap-1 py-1">
                          {classifications.map((c) => (
                            <div key={c.label} className="flex items-center gap-1.5 text-xs">
                              <span className="w-14 shrink-0">{c.label}</span>
                              {c.winner ? (
                                <span className="inline-flex items-center gap-1.5 text-[var(--text)]">
                                  <TeamJersey jerseyUrl={c.winner.team?.jerseyUrl} color={c.winner.team?.color} className="h-4 w-4 rounded" />
                                  <Flag nationality={c.winner.rider.nationality} />
                                  <Link href={`/riders/${c.winner.rider.id}`} className="hover:text-[var(--accent)]">
                                    {fullName(c.winner.rider)}
                                  </Link>
                                </span>
                              ) : (
                                "—"
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  ) : race.results[0] ? (
                    <span className="inline-flex items-center gap-2">
                      <Flag nationality={race.results[0].rider.nationality} />
                      <Link href={`/riders/${race.results[0].rider.id}`} className="hover:text-[var(--accent)]">
                        {fullName(race.results[0].rider)}
                      </Link>
                      {race.results[0].team && (
                        <Link href={`/teams/${race.results[0].team.id}`} className="text-xs text-[var(--text-dim)] hover:text-[var(--accent)]">
                          ({race.results[0].team.name})
                        </Link>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {races.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[var(--text-dim)]">
                  Aucune course pour cette saison.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
