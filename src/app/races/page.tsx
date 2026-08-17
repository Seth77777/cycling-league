import Link from "next/link";
import { getRaces, listSeasons } from "@/lib/queries";

export default async function RacesPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: seasonParam } = await searchParams;
  const seasons = await listSeasons();
  const season = seasonParam ? Number(seasonParam) : seasons[0];
  const races = await getRaces(season);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Link href="/races/new" className="btn btn-primary">
          + New race
        </Link>
      </div>

      <div className="flex gap-2">
        {seasons.map((s) => (
          <Link
            key={s}
            href={`/races?season=${s}`}
            className={`btn ${s === season ? "btn-primary" : ""}`}
          >
            {s}
          </Link>
        ))}
        {seasons.length === 0 && <p className="text-sm text-[var(--text-dim)]">No seasons yet.</p>}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--text-dim)]">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Race</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Results</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {races.map((race) => (
              <tr key={race.id} className="bg-[var(--surface)] hover:bg-[var(--surface-2)]">
                <td className="px-4 py-2 text-[var(--text-dim)]">{race.date.toLocaleDateString()}</td>
                <td className="px-4 py-2">
                  <Link href={`/races/${race.id}`} className="hover:text-[var(--accent)]">
                    {race.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-[var(--text-dim)]">{race.category.name}</td>
                <td className="px-4 py-2 text-[var(--text-dim)]">{race._count.results} entries</td>
              </tr>
            ))}
            {races.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[var(--text-dim)]">
                  No races in this season yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
