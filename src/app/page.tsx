import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getRiderRankings, listSeasons, fullName } from "@/lib/queries";

export default async function DashboardPage() {
  const seasons = await listSeasons();
  const currentSeason = seasons[0];
  const [riderCount, teamCount, raceCount, rankings, upcoming] = await Promise.all([
    prisma.rider.count(),
    prisma.team.count(),
    prisma.race.count(),
    currentSeason ? getRiderRankings(currentSeason) : Promise.resolve([]),
    prisma.race.findMany({
      where: currentSeason ? { season: currentSeason, date: { gte: new Date() } } : undefined,
      include: { category: true },
      orderBy: { date: "asc" },
      take: 5,
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-[var(--text-dim)]">
          {riderCount} riders · {teamCount} teams · {raceCount} races recorded
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">
              Top of {currentSeason ?? "—"} ranking
            </h2>
            <Link href="/rankings" className="text-xs text-[var(--accent)] hover:underline">
              Full ranking →
            </Link>
          </div>
          {rankings.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">No results recorded yet.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {rankings.slice(0, 5).map((r, i) => (
                <li key={r.rider.id} className="flex items-center justify-between text-sm">
                  <Link href={`/riders/${r.rider.id}`} className="hover:text-[var(--accent)]">
                    <span className="mr-2 text-[var(--text-dim)]">{i + 1}.</span>
                    {fullName(r.rider)}
                  </Link>
                  <span className="font-mono text-[var(--text-dim)]">{r.points} pts</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Upcoming races</h2>
            <Link href="/races" className="text-xs text-[var(--accent)] hover:underline">
              Full calendar →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">No upcoming races scheduled.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {upcoming.map((race) => (
                <li key={race.id} className="flex items-center justify-between text-sm">
                  <Link href={`/races/${race.id}`} className="hover:text-[var(--accent)]">
                    {race.name}
                  </Link>
                  <span className="text-[var(--text-dim)]">
                    {race.date.toLocaleDateString()} · {race.category.name}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
