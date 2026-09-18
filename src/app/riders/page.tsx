import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getLatestSeason } from "@/lib/queries";
import { RidersStatsTable, type RiderRow } from "@/components/RidersStatsTable";

export default async function RidersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; season?: string }>;
}) {
  const { sort: sortParam, dir: dirParam, season: seasonParam } = await searchParams;
  const sort = sortParam || "lastName";
  const dir: "asc" | "desc" = dirParam === "asc" ? "asc" : "desc" === dirParam ? "desc" : "asc";
  const latestSeason = await getLatestSeason();
  const season = seasonParam ? Number(seasonParam) : latestSeason;
  const seasons = Array.from({ length: latestSeason }, (_, i) => i + 1);

  const riders = await prisma.rider.findMany({
    where: { unpickedSeason: null },
    include: { stints: { include: { team: true } } },
  });

  const rows: RiderRow[] = riders
    .map((r) => {
      const stint = r.stints.find((s) => s.startSeason <= season && (s.endSeason === null || season < s.endSeason));
      return {
        id: r.id,
        lastName: r.lastName,
        firstName: r.firstName,
        nationality: r.nationality,
        retired: r.retired,
        age: r.age,
        potential: r.potential,
        moyenne: r.moyenne,
        teamName: stint?.team.name ?? null,
        teamId: stint?.team.id ?? null,
        teamJerseyUrl: stint?.team.jerseyUrl ?? null,
        teamColor: stint?.team.color ?? null,
        statPl: r.statPl,
        statMo: r.statMo,
        statVal: r.statVal,
        statClm: r.statClm,
        statPrl: r.statPrl,
        statPav: r.statPav,
        statSp: r.statSp,
        statAcc: r.statAcc,
        statDes: r.statDes,
        statBar: r.statBar,
        statEnd: r.statEnd,
        statRes: r.statRes,
        statRec: r.statRec,
        _hasStint: stint != null,
      };
    })
    .filter((r) => r._hasStint);

  function sortHref(key: string) {
    const nextDir = sort === key && dir === "desc" ? "asc" : "desc";
    return `/riders?season=${season}&sort=${key}&dir=${nextDir}`;
  }

  function seasonHref(s: number) {
    return `/riders?season=${s}&sort=${sort}&dir=${dir}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Coureurs</h1>
        <p className="text-sm text-[var(--text-dim)]">{rows.length} coureurs · cliquez un en-tête pour trier</p>
      </div>

      <div className="flex gap-2">
        {seasons.map((s) => (
          <Link key={s} href={seasonHref(s)} className={`btn ${s === season ? "btn-primary" : ""}`}>
            Saison {s}
          </Link>
        ))}
      </div>

      <RidersStatsTable
        rows={rows}
        sort={sort}
        dir={dir}
        sortHref={sortHref}
        emptyMessage="Aucun coureur dans l'effectif cette saison-là."
      />
    </div>
  );
}
