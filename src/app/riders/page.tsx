import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/queries";

export default async function RidersPage() {
  const riders = await prisma.rider.findMany({
    include: { stints: { where: { endDate: null }, include: { team: true } } },
    orderBy: [{ retired: "asc" }, { lastName: "asc" }],
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Riders</h1>
        <Link
          href="/riders/new"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
        >
          + New rider
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--text-dim)]">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Nationality</th>
              <th className="px-4 py-2">Team</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {riders.map((rider) => {
              const team = rider.stints[0]?.team;
              return (
                <tr key={rider.id} className="bg-[var(--surface)] hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-2">
                    <Link href={`/riders/${rider.id}`} className="hover:text-[var(--accent)]">
                      {fullName(rider)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-[var(--text-dim)]">{rider.nationality ?? "—"}</td>
                  <td className="px-4 py-2 text-[var(--text-dim)]">
                    {team ? (
                      <Link href={`/teams/${team.id}`} className="hover:text-[var(--accent)]">
                        {team.name}
                      </Link>
                    ) : (
                      "Free agent"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {rider.retired ? (
                      <span className="text-[var(--text-dim)]">Retired</span>
                    ) : (
                      <span className="text-[var(--accent-2)]">Active</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {riders.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[var(--text-dim)]">
                  No riders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
