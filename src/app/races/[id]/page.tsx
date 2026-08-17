import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRaceDetail, fullName } from "@/lib/queries";
import { addResult, deleteResult } from "@/lib/actions";
import { parsePointsByRank, pointsForRank } from "@/lib/points";

const MEDAL = ["🥇", "🥈", "🥉"];

export default async function RaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [race, riders] = await Promise.all([
    getRaceDetail(id),
    prisma.rider.findMany({
      include: { stints: { where: { endDate: null }, include: { team: true } } },
      orderBy: { lastName: "asc" },
    }),
  ]);
  if (!race) notFound();

  const scale = parsePointsByRank(race.category.pointsByRank);
  const enteredRiderIds = new Set(race.results.map((r) => r.riderId));
  const available = riders.filter((r) => !enteredRiderIds.has(r.id));
  const nextRank = race.results.length + 1;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{race.name}</h1>
        <p className="text-sm text-[var(--text-dim)]">
          {race.date.toLocaleDateString()} · {race.season} · {race.category.name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 font-semibold">Results</h2>
          {race.results.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">No results entered yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border)]">
                {race.results.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-2">{r.rank <= 3 ? MEDAL[r.rank - 1] : `#${r.rank}`}</td>
                    <td className="py-2">
                      <Link href={`/riders/${r.riderId}`} className="hover:text-[var(--accent)]">
                        {fullName(r.rider)}
                      </Link>
                    </td>
                    <td className="py-2 text-[var(--text-dim)]">{r.team?.name ?? "—"}</td>
                    <td className="py-2 text-right font-mono">{r.points} pts</td>
                    <td className="py-2 pl-2 text-right">
                      <form
                        action={async () => {
                          "use server";
                          await deleteResult(r.id);
                        }}
                      >
                        <button type="submit" className="text-xs text-[var(--danger)] hover:underline">
                          remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 font-semibold">Add a result</h2>
          <form action={addResult} className="flex flex-col gap-3">
            <input type="hidden" name="raceId" value={race.id} />
            <label className="flex flex-col gap-1 text-sm">
              Rider
              <select name="riderId" required className="input">
                <option value="">Select rider…</option>
                {available.map((r) => (
                  <option key={r.id} value={r.id}>
                    {fullName(r)}
                    {r.stints[0] ? ` — ${r.stints[0].team.name}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <TeamPicker riders={available} />
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Rank
                <input name="rank" type="number" min={1} required defaultValue={nextRank} className="input" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Points (auto if blank)
                <input name="points" type="number" placeholder={`e.g. ${pointsForRank(scale, nextRank)}`} className="input" />
              </label>
            </div>
            <p className="text-xs text-[var(--text-dim)]">
              Scale for this category: {scale.join(" / ") || "no points configured"}
            </p>
            <button type="submit" className="btn btn-primary mt-1">
              Add result
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

// Simple team dropdown; keeps team selection independent from rider (covers loaned/guest riders).
function TeamPicker({ riders }: { riders: { id: string; stints: { team: { id: string; name: string } }[] }[] }) {
  const teams = new Map<string, string>();
  for (const r of riders) {
    const t = r.stints[0]?.team;
    if (t) teams.set(t.id, t.name);
  }
  return (
    <label className="flex flex-col gap-1 text-sm">
      Team at time of race
      <select name="teamId" className="input">
        <option value="">— none / independent —</option>
        {[...teams.entries()].map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
