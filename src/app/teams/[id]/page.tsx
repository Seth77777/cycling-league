import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamDetail, fullName } from "@/lib/queries";
import { getTeamRankings } from "@/lib/queries";

function fmtDate(d: Date | null) {
  return d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "present";
}

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getTeamDetail(id);
  if (!detail) notFound();
  const { team, current, past } = detail;

  const rankings = await getTeamRankings();
  const standing = rankings.findIndex((r) => r.team.id === team.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ background: team.color ?? "var(--text-dim)" }} />
        <div>
          <h1 className="text-2xl font-bold">{team.name}</h1>
          <p className="text-sm text-[var(--text-dim)]">
            {team.country ?? "—"}
            {standing >= 0 && ` · #${standing + 1} in all-time team ranking · ${rankings[standing].points} pts`}
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 font-semibold">Current roster ({current.length})</h2>
        {current.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">No riders currently signed.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {current.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/riders/${s.rider.id}`}
                  className="block rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:border-[var(--accent)]"
                >
                  {fullName(s.rider)}
                  <div className="text-xs text-[var(--text-dim)]">since {fmtDate(s.startDate)}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 font-semibold">Past riders ({past.length})</h2>
        {past.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">No departures recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--border)]">
              {past.map((s) => (
                <tr key={s.id}>
                  <td className="py-2">
                    <Link href={`/riders/${s.rider.id}`} className="hover:text-[var(--accent)]">
                      {fullName(s.rider)}
                    </Link>
                  </td>
                  <td className="py-2 text-right text-[var(--text-dim)]">
                    {fmtDate(s.startDate)} — {fmtDate(s.endDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
