import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    include: { _count: { select: { stints: true } }, stints: { where: { endDate: null } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Teams</h1>
        <Link href="/teams/new" className="btn btn-primary">
          + New team
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/teams/${team.id}`}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--accent)]"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: team.color ?? "var(--text-dim)" }}
              />
              <span className="font-semibold">{team.name}</span>
            </div>
            <div className="mt-1 text-xs text-[var(--text-dim)]">
              {team.country ?? "—"} · {team.stints.length} current riders
            </div>
          </Link>
        ))}
        {teams.length === 0 && <p className="text-sm text-[var(--text-dim)]">No teams yet.</p>}
      </div>
    </div>
  );
}
