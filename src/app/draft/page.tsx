import Link from "next/link";
import { getDraftBoard, getLatestSeason, listSeasons, isSeasonComplete, fullName } from "@/lib/queries";
import { addDraftPick } from "@/lib/actions";
import { bandColor } from "@/lib/heat";
import { STAT_COLUMNS } from "@/components/RidersStatsTable";
import { Flag } from "@/components/Flag";
import { isAdmin } from "@/lib/session";

export default async function DraftPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: seasonParam } = await searchParams;
  const latestSeason = await getLatestSeason();
  const season = seasonParam ? Number(seasonParam) : latestSeason;
  const seasons = Array.from({ length: latestSeason }, (_, i) => i + 1);

  const { standingsOrder, picksInOrder, pool, retirees } = await getDraftBoard(season);
  const admin = await isAdmin();
  // Not latestSeason: the first pick's TeamStint already starts next season, which
  // would immediately push getLatestSeason() forward and hide this form again.
  const currentRaceSeason = (await listSeasons())[0];
  const canAddPicks = admin && season === currentRaceSeason && (await isSeasonComplete(season));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Draft — Saison {season}</h1>
        <p className="text-sm text-[var(--text-dim)]">
          Ordre inversé du classement général de la saison {season} — la dernière équipe pioche en premier (une
          équipe peut piocher plusieurs fois). Les picks rejoignent la ligue en saison {season + 1}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {seasons.map((s) => (
          <Link key={s} href={`/draft?season=${s}`} className={`btn ${s === season ? "btn-primary" : ""}`}>
            Saison {s}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 font-semibold">Ordre (classement inversé saison {season})</h2>
          <ol className="flex flex-col gap-1 text-sm">
            {standingsOrder.map((s) => (
              <li key={s.team.id} className="flex items-center justify-between">
                <span>
                  <span className="mr-2 font-mono text-[var(--text-dim)]">{s.rank}.</span>
                  <Link href={`/teams/${s.team.id}`} className="hover:text-[var(--accent)]">
                    {s.team.name}
                  </Link>
                </span>
                <span className="font-mono text-[var(--text-dim)]">{s.points} pts</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 font-semibold">Retraites — Saison {season} ({retirees.length})</h2>
          {retirees.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">Aucune retraite enregistrée.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {retirees.map((r) => (
                <li key={r.id}>
                  <Link href={`/riders/${r.id}`} className="hover:text-[var(--accent)]">
                    {fullName(r)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {pool.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Coureurs disponibles — pas encore sélectionnés ({pool.length})</h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-2)] text-center text-xs uppercase text-[var(--text-dim)]">
                <tr>
                  <th className="px-2 py-2">Nom</th>
                  <th className="px-2 py-2">Prénom</th>
                  <th className="px-2 py-2">Nat.</th>
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
                {pool.map((rider) => (
                  <tr key={rider.id} className="bg-[var(--surface)] hover:bg-[var(--surface-2)]">
                    <td className="whitespace-nowrap px-2 py-1.5 text-center">
                      <Link href={`/draft/${rider.id}`} className="hover:text-[var(--accent)]" title="Simuler un entraînement pluriannuel">
                        {rider.lastName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-center">
                      <Link href={`/draft/${rider.id}`} className="hover:text-[var(--accent)]">
                        {rider.firstName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-center text-[var(--text-dim)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Flag nationality={rider.nationality} />
                        {rider.nationality ?? "—"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono">{rider.age ?? "—"}</td>
                    <td className="px-2 py-1.5 text-center font-mono">{rider.potential ?? "—"}</td>
                    {STAT_COLUMNS.map((c) => (
                      <td
                        key={c.key}
                        className="px-2 py-1.5 text-center font-mono text-black"
                        style={{ background: bandColor((rider as Record<string, unknown>)[c.key] as number | null) }}
                      >
                        {((rider as Record<string, unknown>)[c.key] as number | null) ?? "—"}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center font-mono text-black" style={{ background: bandColor(rider.moyenne) }}>
                      {rider.moyenne?.toFixed(2) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Choix de la draft — dans l&apos;ordre ({picksInOrder.length})</h2>
        {picksInOrder.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">Aucun choix enregistré pour cette saison.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-2)] text-center text-xs uppercase text-[var(--text-dim)]">
                <tr>
                  <th className="px-2 py-2">Pick</th>
                  <th className="px-2 py-2">Nom</th>
                  <th className="px-2 py-2">Prénom</th>
                  <th className="px-2 py-2">Nat.</th>
                  <th className="px-2 py-2">Équipe</th>
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
                {picksInOrder.map(({ rider, team }) => (
                  <tr key={rider.id} className="bg-[var(--surface)]">
                    <td className="px-2 py-1.5 text-center font-mono text-[var(--text-dim)]">#{rider.draftPick}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-center">
                      <Link href={`/riders/${rider.id}`} className="hover:text-[var(--accent)]">
                        {rider.lastName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-center">{rider.firstName}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-center text-[var(--text-dim)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Flag nationality={rider.nationality} />
                        {rider.nationality ?? "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-center text-[var(--text-dim)]">
                      {team ? (
                        <Link href={`/teams/${team.id}`} className="hover:text-[var(--accent)]">
                          {team.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono">{rider.age ?? "—"}</td>
                    <td className="px-2 py-1.5 text-center font-mono">{rider.potential ?? "—"}</td>
                    {STAT_COLUMNS.map((c) => (
                      <td
                        key={c.key}
                        className="px-2 py-1.5 text-center font-mono text-black"
                        style={{ background: bandColor((rider as Record<string, unknown>)[c.key] as number | null) }}
                      >
                        {((rider as Record<string, unknown>)[c.key] as number | null) ?? "—"}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center font-mono text-black" style={{ background: bandColor(rider.moyenne) }}>
                      {rider.moyenne?.toFixed(2) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canAddPicks && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 font-semibold">Ajouter un pick</h2>
          <form action={addDraftPick} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="season" value={season} />
            <label className="flex flex-col gap-1 text-xs text-[var(--text-dim)]">
              Équipe
              <select name="teamId" required className="input">
                {standingsOrder.map((s) => (
                  <option key={s.team.id} value={s.team.id}>
                    {s.team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--text-dim)]">
              Coureur pioché
              <input name="riderName" required className="input" placeholder="Prénom Nom" />
            </label>
            <button type="submit" className="btn btn-primary">
              Ajouter le pick #{picksInOrder.length + 1}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
