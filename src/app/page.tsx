import Link from "next/link";
import {
  getRiderRankings,
  getTeamRankings,
  getNationRankings,
  getNextRace,
  getRandomRiderCard,
  getDefendingChampion,
  listSeasons,
  fullName,
} from "@/lib/queries";
import { Flag } from "@/components/Flag";
import { TeamJersey } from "@/components/TeamJersey";
import { RaceLogo } from "@/components/RaceLogo";
import { STAT_COLUMNS } from "@/components/RidersStatsTable";
import { bandColor } from "@/lib/heat";
import { StarRating } from "@/components/StarRating";

const RIDER_RANKING_PREVIEW_SIZE = 25;
const MEDAL = ["🥇", "🥈", "🥉"];

function Rank({ i }: { i: number }) {
  return <span className={MEDAL[i] ? "text-base" : "font-display text-[var(--text-dim)]"}>{MEDAL[i] ?? i + 1}</span>;
}

function SeeAll({ href, compact = false }: { href: string; compact?: boolean }) {
  return (
    <Link href={href} className="text-xs font-medium text-[var(--text-dim)] underline decoration-[var(--border)] underline-offset-4 hover:text-[var(--accent)] hover:decoration-[var(--accent)]">
      {compact ? "Tout voir" : "Voir tout le classement"}
    </Link>
  );
}

export default async function DashboardPage() {
  const seasons = await listSeasons();
  const currentSeason = seasons[0];
  const [riderRankings, teamRankings, nationRankings, nextRace, randomRiderCard] = await Promise.all([
    currentSeason ? getRiderRankings(currentSeason) : Promise.resolve([]),
    currentSeason ? getTeamRankings(currentSeason) : Promise.resolve([]),
    currentSeason ? getNationRankings(currentSeason) : Promise.resolve([]),
    currentSeason ? getNextRace(currentSeason) : Promise.resolve(null),
    getRandomRiderCard(),
  ]);

  const defendingChampion =
    nextRace && currentSeason && currentSeason > 1 ? await getDefendingChampion(nextRace.name, currentSeason - 1) : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-center py-2">
        <h1 className="font-hand shine-text text-center text-6xl leading-none">L&apos;ère des Superligues</h1>
      </div>

      {nextRace && (
        <section className="overflow-hidden rounded-lg border border-[var(--border)]">
          <div className="flex flex-wrap items-center gap-4 bg-[var(--ink)] px-6 py-5">
            <RaceLogo logoUrl={nextRace.logoUrl} className="h-16 w-16 shrink-0 rounded-md bg-white/5 object-contain p-1" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium tracking-wide text-white/50">Prochaine course</div>
              <Link href={`/races/${nextRace.id}`} className="font-display block truncate text-3xl leading-tight !text-white hover:!text-[var(--accent)]">
                {nextRace.name}
              </Link>
              <p className="mt-1 flex items-center gap-2 text-sm text-white/60">
                {nextRace.country && <Flag nationality={nextRace.country} />}
                {nextRace.country ?? "Pays inconnu"}
                <span aria-hidden>·</span>
                {nextRace.category.name}
                {nextRace.order != null && (
                  <>
                    <span aria-hidden>·</span>
                    course n°{nextRace.order}
                  </>
                )}
              </p>
            </div>
            <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
              <p className="flex items-center gap-2 text-sm text-white/60">
                Tenant du titre :
                {defendingChampion ? (
                  <Link href={`/riders/${defendingChampion.rider.id}`} className="inline-flex items-center gap-1.5 font-medium !text-white hover:!text-[var(--accent)]">
                    <Flag nationality={defendingChampion.rider.nationality} />
                    {fullName(defendingChampion.rider)}
                  </Link>
                ) : (
                  <span className="text-lg font-semibold !text-white">—</span>
                )}
              </p>
              <Link
                href="/races"
                className="text-xs font-medium text-white/60 underline decoration-white/20 underline-offset-4 hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
              >
                Voir le calendrier complet
              </Link>
            </div>
          </div>
          {nextRace.profileUrl && (
            <div className="border-t-2 border-[var(--accent)] bg-white p-3">
              <img
                src={nextRace.profileUrl}
                alt={`Profil de ${nextRace.name}`}
                className="mx-auto w-full max-w-2xl object-contain"
              />
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] lg:col-span-2">
          <div className="border-t-[3px] border-[var(--accent)] px-5 pb-3 pt-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Individuel — Saison {currentSeason ?? "—"}</h2>
              <SeeAll href="/rankings?view=rider" />
            </div>
          </div>
          {riderRankings.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-[var(--text-dim)]">Aucun résultat enregistré pour l&apos;instant.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-[var(--text-dim)]">
                <tr className="border-y border-[var(--border)]">
                  <th className="w-10 px-5 py-2 align-middle font-medium">#</th>
                  <th className="px-2 py-2 align-middle font-medium">Coureur</th>
                  <th className="px-2 py-2 align-middle font-medium">Équipe</th>
                  <th className="w-20 px-5 py-2 text-right align-middle font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {riderRankings.slice(0, RIDER_RANKING_PREVIEW_SIZE).map((r, i) => (
                  <tr key={r.rider.id} className="group odd:bg-[var(--surface)] even:bg-[var(--surface-2)]/50 transition-colors duration-200 hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-2 align-middle">
                      <Rank i={i} />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Link href={`/riders/${r.rider.id}`} className="inline-flex items-center gap-2 hover:text-[var(--accent)]">
                        <Flag nationality={r.rider.nationality} className="inline-block h-3.5 w-5 shrink-0 rounded-sm object-cover transition-transform duration-300 group-hover:scale-125" />
                        {fullName(r.rider)}
                      </Link>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      {r.team ? (
                        <Link href={`/teams/${r.team.id}`} className="inline-flex items-center gap-2 text-[var(--text-dim)] hover:text-[var(--accent)]">
                          <TeamJersey jerseyUrl={r.team.jerseyUrl} color={r.team.color} className="h-6 w-6 rounded transition-transform duration-300 group-hover:scale-125" />
                          {r.team.name}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-[var(--text-dim)]">
                          <span className="h-6 w-6 shrink-0" aria-hidden />
                          Agent libre
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-right align-middle font-mono">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-t-[3px] border-[var(--text-dim)] px-4 pb-2 pt-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Équipes — Saison {currentSeason ?? "—"}</h2>
                <SeeAll href="/rankings?view=team" compact />
              </div>
            </div>
            {teamRankings.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-[var(--text-dim)]">Aucun résultat pour l&apos;instant.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {teamRankings.slice(0, 10).map((r, i) => (
                    <tr key={r.team.id} className="group odd:bg-[var(--surface)] even:bg-[var(--surface-2)]/50 transition-colors duration-200 hover:bg-[var(--surface-2)]">
                      <td className="w-8 px-4 py-1.5 align-middle">
                        <Rank i={i} />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <Link href={`/teams/${r.team.id}`} className="inline-flex items-center gap-2 hover:text-[var(--accent)]">
                          <TeamJersey jerseyUrl={r.team.jerseyUrl} color={r.team.color} className="h-5 w-5 rounded transition-transform duration-300 group-hover:scale-125" />
                          {r.team.name}
                        </Link>
                      </td>
                      <td className="px-4 py-1.5 text-right align-middle font-mono">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-t-[3px] border-[var(--accent-2)] px-4 pb-2 pt-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Nations — top 3</h2>
                <SeeAll href="/rankings?view=nation" compact />
              </div>
            </div>
            {nationRankings.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-[var(--text-dim)]">Aucun résultat pour l&apos;instant.</p>
            ) : (
              <div className="flex flex-col gap-2 px-4 pb-4">
                {nationRankings.slice(0, 3).map((r, i) => (
                  <div key={r.nationality} className="group flex items-center justify-between rounded px-1 py-0.5 text-sm transition-colors duration-200 hover:bg-[var(--surface-2)]">
                    <span className="inline-flex items-center gap-2">
                      <Rank i={i} />
                      <Flag nationality={r.nationality} className="inline-block h-3.5 w-5 shrink-0 rounded-sm object-cover transition-transform duration-300 group-hover:scale-125" />
                      {r.nationality}
                    </span>
                    <span className="font-mono text-[var(--text-dim)]">{r.points}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {randomRiderCard && (
            <section className="group relative overflow-hidden rounded-lg border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:shadow-xl hover:shadow-black/30">
              <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[var(--danger)]/10 blur-3xl transition-all duration-300 group-hover:h-56 group-hover:w-56 group-hover:bg-[var(--danger)]/20" />
              <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-[var(--accent)]/10 blur-3xl transition-all duration-300 group-hover:h-56 group-hover:w-56 group-hover:bg-[var(--accent)]/20" />
              <div className="relative flex flex-col items-center text-center">
                <span className="text-xs font-medium text-[var(--text-dim)]">Coureur au hasard</span>
                <Link
                  href={`/riders/${randomRiderCard.rider.id}`}
                  className="font-hand mt-1 inline-flex items-center gap-2 text-5xl leading-none text-[var(--accent)] transition-transform duration-300 group-hover:scale-105"
                  style={{ textShadow: "0 2px 16px color-mix(in srgb, var(--accent) 40%, transparent)" }}
                >
                  <Flag nationality={randomRiderCard.rider.nationality} className="h-7 w-10 shrink-0 rounded-sm object-cover" />
                  {fullName(randomRiderCard.rider)}
                </Link>
                <StarRating value={randomRiderCard.reputation} glow wave className="mt-1.5 text-xl" />
                <p className="mt-2 text-xs text-[var(--text-dim)]">
                  {randomRiderCard.firstSeason != null
                    ? `Saison ${randomRiderCard.firstSeason} — ${randomRiderCard.stillActive ? "présent" : `saison ${randomRiderCard.lastSeason}`}`
                    : "Aucune saison enregistrée"}
                  {randomRiderCard.rider.stints.length > 0 &&
                    ` · ${[...new Set(randomRiderCard.rider.stints.map((s) => s.team.name))].join(" → ")}`}
                </p>
                <p className="mt-1 text-xs text-[var(--text-dim)]">
                  {randomRiderCard.palmares.wins} victoires · {randomRiderCard.palmares.podiums} podiums · meilleure
                  moyenne {randomRiderCard.moyenneCareerBest?.toFixed(2) ?? "—"}
                </p>
                <div className="mt-4 inline-grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {STAT_COLUMNS.map((c) => {
                    const value = randomRiderCard.careerBestStats[c.key as keyof typeof randomRiderCard.careerBestStats];
                    const known = Number.isFinite(value);
                    return (
                      <div key={c.key} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[var(--text-dim)]">{c.label}</span>
                        <span
                          className={`min-w-[2rem] rounded px-1.5 text-center font-mono font-semibold ${known ? "text-black" : "text-[var(--text-dim)]"}`}
                          style={known ? { background: bandColor(value) } : undefined}
                        >
                          {known ? value : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
