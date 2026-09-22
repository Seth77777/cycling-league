import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamDetail, getTeamRankings, getLatestSeason, listSeasons, isSeasonComplete, fullName } from "@/lib/queries";
import { RidersStatsTable, type RiderRow } from "@/components/RidersStatsTable";
import { TeamJersey } from "@/components/TeamJersey";
import { isAdmin } from "@/lib/session";
import { updateTeam } from "@/lib/actions";

function fmtSeasonRange(start: number, end: number | null) {
  if (end === null) return `Saison ${start} — présent`;
  if (end === start) return `Saison ${start} (transféré avant le début de saison)`;
  return `Saison ${start} — saison ${end - 1}`;
}

export default async function TeamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string; sort?: string; dir?: string; psort?: string; pdir?: string }>;
}) {
  const { id } = await params;
  const { season: seasonParam, sort: sortParam, dir: dirParam, psort: psortParam, pdir: pdirParam } = await searchParams;
  const latestSeason = await getLatestSeason();
  const season = seasonParam ? Number(seasonParam) : latestSeason;
  const sort = sortParam || "lastName";
  const dir: "asc" | "desc" = dirParam === "asc" ? "asc" : "desc" === dirParam ? "desc" : "asc";
  const psort = psortParam || "lastName";
  const pdir: "asc" | "desc" = pdirParam === "desc" ? "desc" : "asc";

  const detail = await getTeamDetail(id, season);
  if (!detail) notFound();
  const { team, roster, allStints } = detail;

  // Not latestSeason: a draft pick's TeamStint already starts next season, which
  // would immediately push getLatestSeason() forward past the season that just ended.
  const currentRaceSeason = (await listSeasons())[0];
  const seasonComplete = currentRaceSeason ? await isSeasonComplete(currentRaceSeason) : false;
  const previewSeason = currentRaceSeason + 1;
  const nextDetail = seasonComplete ? await getTeamDetail(id, previewSeason) : null;

  const rankings = await getTeamRankings();
  const standing = rankings.findIndex((r) => r.team.id === team.id);
  const seasons = Array.from({ length: latestSeason }, (_, i) => i + 1);
  const admin = await isAdmin();

  const rows: RiderRow[] = roster.map((s) => ({
    id: s.rider.id,
    lastName: s.rider.lastName,
    firstName: s.rider.firstName,
    nationality: s.rider.nationality,
    retired: s.rider.retired,
    age: s.rider.age,
    potential: s.rider.potential,
    moyenne: s.rider.moyenne,
    teamName: null,
    teamId: null,
    statPl: s.rider.statPl,
    statMo: s.rider.statMo,
    statVal: s.rider.statVal,
    statClm: s.rider.statClm,
    statPrl: s.rider.statPrl,
    statPav: s.rider.statPav,
    statSp: s.rider.statSp,
    statAcc: s.rider.statAcc,
    statDes: s.rider.statDes,
    statBar: s.rider.statBar,
    statEnd: s.rider.statEnd,
    statRes: s.rider.statRes,
    statRec: s.rider.statRec,
  }));

  const previewRows: RiderRow[] = (nextDetail?.roster ?? []).map((s) => ({
    id: s.rider.id,
    lastName: s.rider.lastName,
    firstName: s.rider.firstName,
    nationality: s.rider.nationality,
    retired: s.rider.retired,
    age: s.rider.age,
    potential: s.rider.potential,
    moyenne: s.rider.moyenne,
    teamName: null,
    teamId: null,
    statPl: s.rider.statPl,
    statMo: s.rider.statMo,
    statVal: s.rider.statVal,
    statClm: s.rider.statClm,
    statPrl: s.rider.statPrl,
    statPav: s.rider.statPav,
    statSp: s.rider.statSp,
    statAcc: s.rider.statAcc,
    statDes: s.rider.statDes,
    statBar: s.rider.statBar,
    statEnd: s.rider.statEnd,
    statRes: s.rider.statRes,
    statRec: s.rider.statRec,
  }));

  function sortHref(key: string) {
    const nextDir = sort === key && dir === "desc" ? "asc" : "desc";
    return `/teams/${id}?season=${season}&sort=${key}&dir=${nextDir}`;
  }

  function sortHrefPreview(key: string) {
    const nextDir = psort === key && pdir === "desc" ? "asc" : "desc";
    return `/teams/${id}?season=${season}&sort=${sort}&dir=${dir}&psort=${key}&pdir=${nextDir}`;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <TeamJersey jerseyUrl={team.jerseyUrl} color={team.color} className="h-28 w-28 rounded-lg" />
        <div>
          <h1 className="text-2xl font-bold">{team.name}</h1>
          <p className="text-sm text-[var(--text-dim)]">
            {team.country ?? "—"} · Manager : {team.manager ?? "—"}
            {standing >= 0 && ` · #${standing + 1} au classement toutes saisons · ${rankings[standing].points} pts`}
          </p>
        </div>
      </div>

      {admin && (
        <details className="group rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-[var(--text-dim)] hover:text-[var(--accent)]">
            Modifier l&apos;équipe
          </summary>
          <form action={updateTeam} className="mt-3 flex flex-col gap-3 max-w-sm">
            <input type="hidden" name="id" value={team.id} />
            <label className="flex flex-col gap-1 text-sm">
              Nom
              <input name="name" defaultValue={team.name} required className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Pays
              <input name="country" defaultValue={team.country ?? ""} className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Manager
              <input name="manager" defaultValue={team.manager ?? ""} className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Couleur
              <input name="color" type="color" defaultValue={team.color ?? "#8b93a3"} className="input h-10" />
            </label>
            <button type="submit" className="btn btn-primary self-start">
              Enregistrer
            </button>
          </form>
        </details>
      )}

      <div className="flex gap-2">
        {seasons.map((s) => (
          <Link key={s} href={`/teams/${id}?season=${s}&sort=${sort}&dir=${dir}`} className={`btn ${s === season ? "btn-primary" : ""}`}>
            Saison {s}
          </Link>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">
          Effectif — Saison {season} ({roster.length})
        </h2>
        <RidersStatsTable
          rows={rows}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
          showTeamColumn={false}
          emptyMessage="Aucun coureur dans l'effectif cette saison-là."
        />
      </section>

      {seasonComplete && nextDetail && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">
            Effectif prévisionnel — Saison {previewSeason} ({nextDetail.roster.length})
          </h2>
          <RidersStatsTable
            rows={previewRows}
            sort={psort}
            dir={pdir}
            sortHref={sortHrefPreview}
            showTeamColumn={false}
            emptyMessage="Aucun coureur sous contrat ou pioché pour l'instant."
          />
        </section>
      )}

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 font-semibold">Historique complet ({allStints.length})</h2>
        {allStints.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">Aucun historique enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--border)]">
              {[...allStints].reverse().map((s) => (
                <tr key={s.id}>
                  <td className="py-2">
                    <Link href={`/riders/${s.rider.id}`} className="hover:text-[var(--accent)]">
                      {fullName(s.rider)}
                    </Link>
                  </td>
                  <td className="py-2 text-right text-[var(--text-dim)]">{fmtSeasonRange(s.startSeason, s.endSeason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
