import Link from "next/link";
import { notFound } from "next/navigation";
import { getRiderProfile, fullName } from "@/lib/queries";
import { computeResultPoints } from "@/lib/points";
import { bandColor } from "@/lib/heat";
import { STAT_COLUMNS } from "@/components/RidersStatsTable";
import { Flag } from "@/components/Flag";
import { StarRating } from "@/components/StarRating";
import { TeamJersey } from "@/components/TeamJersey";

function fmtSeasonRange(start: number, end: number | null) {
  if (end === null) return `Saison ${start} — présent`;
  if (end === start) return `Saison ${start} (transféré avant le début de saison)`;
  return `Saison ${start} — saison ${end - 1}`;
}

const MEDAL = ["🥇", "🥈", "🥉"];

/** Palmares display threshold per result type — keeps the table short without hiding wins/podiums. */
function showInPalmares(r: { rank: number; race: { resultKind: string } }) {
  if (r.race.resultKind === "stage") return r.rank <= 10;
  if (r.race.resultKind === "jersey") return r.rank <= 1;
  return r.rank <= 15; // "race": a classique or a Grand Tour's general classification
}

type StatSet = {
  age: number | null;
  potential: number | null;
  moyenne: number | null;
  [k: string]: unknown;
};

function StatsTable({ rows }: { rows: { label: string; stats: StatSet }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--surface-2)] text-center text-xs uppercase text-[var(--text-dim)]">
          <tr>
            <th className="px-2 py-2 text-left">Saison</th>
            <th className="px-2 py-2">Âge</th>
            <th className="px-2 py-2">POT</th>
            {STAT_COLUMNS.map((c) => (
              <th key={c.key} className="px-2 py-2">
                {c.label}
              </th>
            ))}
            <th className="px-2 py-2">MOY</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map(({ label, stats }) => (
            <tr key={label} className="bg-[var(--surface)]">
              <td className="whitespace-nowrap px-2 py-1.5 text-left font-medium">{label}</td>
              <td className="px-2 py-1.5 text-center font-mono">{stats.age ?? "—"}</td>
              <td className="px-2 py-1.5 text-center font-mono">{stats.potential ?? "—"}</td>
              {STAT_COLUMNS.map((c) => (
                <td
                  key={c.key}
                  className="px-2 py-1.5 text-center font-mono text-black"
                  style={{ background: bandColor(stats[c.key] as number | null) }}
                >
                  {(stats[c.key] as number | null) ?? "—"}
                </td>
              ))}
              <td className="px-2 py-1.5 text-center font-mono text-black" style={{ background: bandColor(stats.moyenne) }}>
                {stats.moyenne?.toFixed(2) ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function RiderProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getRiderProfile(id);
  if (!profile || profile.rider.unpickedSeason != null) notFound();

  const { rider, currentStint, seasonPoints, palmares, reputation, currentStatsSeason, pastSeasonStats } = profile;
  const hasStats = STAT_COLUMNS.some((c) => (rider as Record<string, unknown>)[c.key] != null);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold">
            <Flag nationality={rider.nationality} className="inline-block h-5 w-7 shrink-0 rounded-sm object-cover" />
            {fullName(rider)}
            <StarRating value={reputation} className="text-lg" />
          </h1>
          <p className="text-sm text-[var(--text-dim)]">
            {rider.nationality ?? "Nationalité inconnue"}
            {rider.age != null && ` · ${rider.age} ans`}
            {rider.potential != null && ` · Potentiel ${rider.potential}`}
            {rider.moyenne != null && ` · Moyenne ${rider.moyenne.toFixed(2)}`}
            {rider.draftSeason > 0 &&
              ` · Drafté saison ${rider.draftSeason}${rider.draftPick != null ? ` (pick #${rider.draftPick})` : ""}`}
            {rider.retired && ` · Retraité${rider.retirementSeason != null ? ` (saison ${rider.retirementSeason})` : ""}`}
          </p>
          {currentStint && (
            <p className="mt-1 text-sm">
              Actuellement à{" "}
              <Link href={`/teams/${currentStint.team.id}`} className="text-[var(--accent)] hover:underline">
                {currentStint.team.name}
              </Link>
            </p>
          )}
        </div>
        {currentStint && (
          <Link href={`/teams/${currentStint.team.id}`} title={currentStint.team.name}>
            <TeamJersey
              jerseyUrl={currentStint.team.jerseyUrl}
              color={currentStint.team.color}
              className="h-24 w-24 rounded-lg border border-[var(--border)]"
            />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
          <div className="text-2xl font-bold text-[var(--accent)]">{palmares.wins}</div>
          <div className="text-xs text-[var(--text-dim)]">Victoires</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
          <div className="text-2xl font-bold">{palmares.podiums}</div>
          <div className="text-xs text-[var(--text-dim)]">Podiums</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
          <div className="text-2xl font-bold">{palmares.top10}</div>
          <div className="text-xs text-[var(--text-dim)]">Top 10</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Team history */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 font-semibold">Historique d&apos;équipe</h2>
          <ol className="flex flex-col gap-3 border-l border-[var(--border)] pl-4">
            {[...rider.stints].reverse().map((s) => (
              <li key={s.id} className="relative flex items-center gap-2.5 text-sm">
                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
                <TeamJersey jerseyUrl={s.team.jerseyUrl} color={s.team.color} className="h-6 w-6 rounded-full" />
                <div>
                  <Link href={`/teams/${s.team.id}`} className="font-medium hover:text-[var(--accent)]">
                    {s.team.name}
                  </Link>
                  <div className="text-xs text-[var(--text-dim)]">{fmtSeasonRange(s.startSeason, s.endSeason)}</div>
                </div>
              </li>
            ))}
            {rider.stints.length === 0 && <p className="text-sm text-[var(--text-dim)]">Aucun historique d&apos;équipe.</p>}
          </ol>
        </section>

        {/* Points by season */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 font-semibold">Points au classement par saison</h2>
          {seasonPoints.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">Aucun point enregistré pour le moment.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border)]">
                {seasonPoints.map(([season, points]) => {
                  const max = Math.max(...seasonPoints.map(([, p]) => p));
                  return (
                    <tr key={season}>
                      <td className="py-2 pr-3 font-mono text-[var(--text-dim)]">{season}</td>
                      <td className="w-full py-2">
                        <div className="h-2 rounded bg-[var(--surface-2)]">
                          <div
                            className="h-2 rounded bg-[var(--accent)]"
                            style={{ width: `${max > 0 ? (points / max) * 100 : 0}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-2 pl-3 text-right font-mono">{points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {hasStats && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Statistiques — Saison {currentStatsSeason}</h2>
          <StatsTable rows={[{ label: `Saison ${currentStatsSeason}`, stats: rider }]} />

          {pastSeasonStats.length > 0 && (
            <details className="group rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <summary className="cursor-pointer select-none text-sm font-medium text-[var(--text-dim)] hover:text-[var(--accent)]">
                Voir les saisons précédentes ({pastSeasonStats.length})
              </summary>
              <div className="mt-3">
                <StatsTable rows={pastSeasonStats.map((s) => ({ label: `Saison ${s.season}`, stats: s }))} />
              </div>
            </details>
          )}
        </section>
      )}

      {/* Palmares */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 font-semibold">Palmares</h2>
        {(() => {
          const palmaresResults = rider.results.filter(showInPalmares);
          return palmaresResults.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">Aucun résultat enregistré pour le moment.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-[var(--text-dim)]">
                <tr>
                  <th className="pb-2">Rang</th>
                  <th className="pb-2">Course</th>
                  <th className="pb-2">Catégorie</th>
                  <th className="pb-2">Équipe</th>
                  <th className="pb-2">Saison</th>
                  <th className="pb-2 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {palmaresResults.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2">{r.rank <= 3 ? MEDAL[r.rank - 1] : `#${r.rank}`}</td>
                    <td className="py-2">
                      <Link href={`/races/${r.raceId}`} className="hover:text-[var(--accent)]">
                        {r.race.name}
                      </Link>
                    </td>
                    <td className="py-2 text-[var(--text-dim)]">{r.race.category.name}</td>
                    <td className="py-2 text-[var(--text-dim)]">{r.team?.name ?? "—"}</td>
                    <td className="py-2 text-[var(--text-dim)]">{r.race.season}</td>
                    <td className="py-2 text-right font-mono">
                      {r.race.isTeamTimeTrial
                        ? (() => {
                            const teamPoints = computeResultPoints(r.race.category, r.race, r.rank);
                            return teamPoints > 0 ? `(${teamPoints} équipe)` : "";
                          })()
                        : r.points > 0
                          ? r.points
                          : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()}
      </section>
    </div>
  );
}
