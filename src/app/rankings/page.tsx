import Link from "next/link";
import { getRiderRankings, getTeamRankings, listSeasons, fullName } from "@/lib/queries";

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; view?: string }>;
}) {
  const { season: seasonParam, view: viewParam } = await searchParams;
  const seasons = await listSeasons();
  const season = seasonParam === "all" ? undefined : seasonParam ? Number(seasonParam) : seasons[0];
  const view = viewParam === "team" ? "team" : "rider";

  const riderRankings = view === "rider" ? await getRiderRankings(season) : [];
  const teamRankings = view === "team" ? await getTeamRankings(season) : [];

  const seasonLink = (s?: number) =>
    `/rankings?view=${view}${s === undefined ? "&season=all" : `&season=${s}`}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Rankings</h1>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Link href={`/rankings?view=rider${season !== undefined ? `&season=${season}` : "&season=all"}`} className={`btn ${view === "rider" ? "btn-primary" : ""}`}>
            Riders
          </Link>
          <Link href={`/rankings?view=team${season !== undefined ? `&season=${season}` : "&season=all"}`} className={`btn ${view === "team" ? "btn-primary" : ""}`}>
            Teams
          </Link>
        </div>
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
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--text-dim)]">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">{view === "rider" ? "Rider" : "Team"}</th>
              <th className="px-4 py-2 text-right">Wins</th>
              <th className="px-4 py-2 text-right">Podiums</th>
              <th className="px-4 py-2 text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {view === "rider"
              ? riderRankings.map((r, i) => (
                  <tr key={r.rider.id} className="bg-[var(--surface)] hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-2 text-[var(--text-dim)]">{i + 1}</td>
                    <td className="px-4 py-2">
                      <Link href={`/riders/${r.rider.id}`} className="hover:text-[var(--accent)]">
                        {fullName(r.rider)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right">{r.wins}</td>
                    <td className="px-4 py-2 text-right">{r.podiums}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.points}</td>
                  </tr>
                ))
              : teamRankings.map((r, i) => (
                  <tr key={r.team.id} className="bg-[var(--surface)] hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-2 text-[var(--text-dim)]">{i + 1}</td>
                    <td className="px-4 py-2">
                      <Link href={`/teams/${r.team.id}`} className="hover:text-[var(--accent)]">
                        {r.team.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right">{r.wins}</td>
                    <td className="px-4 py-2 text-right">{r.podiums}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.points}</td>
                  </tr>
                ))}
            {((view === "rider" && riderRankings.length === 0) || (view === "team" && teamRankings.length === 0)) && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-dim)]">
                  No results recorded for this filter yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
