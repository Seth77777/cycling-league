import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRiderProfile, fullName } from "@/lib/queries";
import { transferRider, setRiderRetired } from "@/lib/actions";

function fmtDate(d: Date | null) {
  return d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "present";
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default async function RiderProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, teams] = await Promise.all([getRiderProfile(id), prisma.team.findMany({ orderBy: { name: "asc" } })]);
  if (!profile) notFound();

  const { rider, currentStint, seasonPoints, palmares } = profile;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{fullName(rider)}</h1>
          <p className="text-sm text-[var(--text-dim)]">
            {rider.nationality ?? "Unknown nationality"}
            {rider.birthDate && ` · born ${fmtDate(rider.birthDate)}`}
            {rider.retired && " · Retired"}
          </p>
          {currentStint && (
            <p className="mt-1 text-sm">
              Currently at{" "}
              <Link href={`/teams/${currentStint.team.id}`} className="text-[var(--accent)] hover:underline">
                {currentStint.team.name}
              </Link>
            </p>
          )}
        </div>
        <form
          action={async () => {
            "use server";
            await setRiderRetired(rider.id, !rider.retired);
          }}
        >
          <button type="submit" className="btn">
            {rider.retired ? "Mark active" : "Mark retired"}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
          <div className="text-2xl font-bold text-[var(--accent)]">{palmares.wins}</div>
          <div className="text-xs text-[var(--text-dim)]">Wins</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
          <div className="text-2xl font-bold">{palmares.podiums}</div>
          <div className="text-xs text-[var(--text-dim)]">Podiums</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
          <div className="text-2xl font-bold">{palmares.top10}</div>
          <div className="text-xs text-[var(--text-dim)]">Top 10s</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Team history */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 font-semibold">Team history</h2>
          <ol className="flex flex-col gap-3 border-l border-[var(--border)] pl-4">
            {[...rider.stints].reverse().map((s) => (
              <li key={s.id} className="relative text-sm">
                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
                <Link href={`/teams/${s.team.id}`} className="font-medium hover:text-[var(--accent)]">
                  {s.team.name}
                </Link>
                <div className="text-xs text-[var(--text-dim)]">
                  {fmtDate(s.startDate)} — {fmtDate(s.endDate)}
                </div>
              </li>
            ))}
            {rider.stints.length === 0 && <p className="text-sm text-[var(--text-dim)]">No team history recorded.</p>}
          </ol>

          <form action={transferRider} className="mt-5 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
            <input type="hidden" name="riderId" value={rider.id} />
            <div className="text-xs font-medium text-[var(--text-dim)]">Record a transfer</div>
            <div className="flex gap-2">
              <select name="teamId" required className="input flex-1">
                <option value="">Team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input name="startDate" type="date" className="input" />
              <button type="submit" className="btn">
                Move
              </button>
            </div>
          </form>
        </section>

        {/* Points by season */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 font-semibold">Ranking points by season</h2>
          {seasonPoints.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">No points recorded yet.</p>
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

      {/* Palmares */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 font-semibold">Palmares</h2>
        {rider.results.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">No results recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-[var(--text-dim)]">
              <tr>
                <th className="pb-2">Rank</th>
                <th className="pb-2">Race</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Team</th>
                <th className="pb-2">Date</th>
                <th className="pb-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rider.results.map((r) => (
                <tr key={r.id}>
                  <td className="py-2">{r.rank <= 3 ? MEDAL[r.rank - 1] : `#${r.rank}`}</td>
                  <td className="py-2">
                    <Link href={`/races/${r.raceId}`} className="hover:text-[var(--accent)]">
                      {r.race.name}
                    </Link>
                  </td>
                  <td className="py-2 text-[var(--text-dim)]">{r.race.category.name}</td>
                  <td className="py-2 text-[var(--text-dim)]">{r.team?.name ?? "—"}</td>
                  <td className="py-2 text-[var(--text-dim)]">{fmtDate(r.race.date)}</td>
                  <td className="py-2 text-right font-mono">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
