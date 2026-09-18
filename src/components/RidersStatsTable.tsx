import Link from "next/link";
import { bandColor } from "@/lib/heat";
import { Flag } from "@/components/Flag";
import { TeamJersey } from "@/components/TeamJersey";

export const STAT_COLUMNS = [
  { key: "statPl", label: "PL" },
  { key: "statMo", label: "MO" },
  { key: "statVal", label: "VAL" },
  { key: "statClm", label: "CLM" },
  { key: "statPrl", label: "PRL" },
  { key: "statPav", label: "PAV" },
  { key: "statSp", label: "SP" },
  { key: "statAcc", label: "ACC" },
  { key: "statDes", label: "DES" },
  { key: "statBar", label: "BAR" },
  { key: "statEnd", label: "END" },
  { key: "statRes", label: "RES" },
  { key: "statRec", label: "REC" },
] as const;

export type RiderRow = {
  id: string;
  lastName: string;
  firstName: string;
  nationality: string | null;
  retired: boolean;
  age: number | null;
  potential: number | null;
  moyenne: number | null;
  teamName: string | null;
  teamId: string | null;
  teamJerseyUrl?: string | null;
  teamColor?: string | null;
  statPl: number | null; statMo: number | null; statVal: number | null; statClm: number | null;
  statPrl: number | null; statPav: number | null; statSp: number | null; statAcc: number | null;
  statDes: number | null; statBar: number | null; statEnd: number | null; statRes: number | null; statRec: number | null;
  [k: string]: unknown;
};

export function sortRiders(rows: RiderRow[], sort: string, dir: "asc" | "desc") {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let va: unknown;
    let vb: unknown;
    if (sort === "team") {
      va = a.teamName ?? "";
      vb = b.teamName ?? "";
    } else {
      va = a[sort];
      vb = b[sort];
    }
    if (va == null && vb == null) return 0;
    if (va == null) return 1; // nulls last regardless of direction
    if (vb == null) return -1;
    if (typeof va === "string" || typeof vb === "string") {
      return factor * String(va).localeCompare(String(vb));
    }
    return factor * ((va as number) - (vb as number));
  });
}

export function RidersStatsTable({
  rows,
  sort,
  dir,
  sortHref,
  showTeamColumn = true,
  emptyMessage = "Aucun coureur.",
}: {
  rows: RiderRow[];
  sort: string;
  dir: "asc" | "desc";
  sortHref: (col: string) => string;
  showTeamColumn?: boolean;
  emptyMessage?: string;
}) {
  const sorted = sortRiders(rows, sort, dir);
  const colCount = 6 + STAT_COLUMNS.length + 1 + (showTeamColumn ? 1 : 0);

  function SortHeader({ col, label }: { col: string; label: string }) {
    const active = sort === col;
    return (
      <th className="px-2 py-2 text-center">
        <Link href={sortHref(col)} className={`inline-flex items-center gap-1 hover:text-[var(--accent)] ${active ? "text-[var(--accent)]" : ""}`}>
          {label}
          {active && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
        </Link>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-[var(--surface-2)] text-xs uppercase text-[var(--text-dim)]">
          <tr>
            <SortHeader col="lastName" label="Nom" />
            <SortHeader col="firstName" label="Prénom" />
            <SortHeader col="nationality" label="Nat." />
            {showTeamColumn && <SortHeader col="team" label="Équipe" />}
            <SortHeader col="age" label="Âge" />
            <SortHeader col="potential" label="POT" />
            {STAT_COLUMNS.map((c) => (
              <SortHeader key={c.key} col={c.key} label={c.label} />
            ))}
            <SortHeader col="moyenne" label="MOY" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {sorted.map((r) => (
            <tr key={r.id} className="bg-[var(--surface)] hover:bg-[var(--surface-2)]">
              <td className="whitespace-nowrap px-2 py-1.5 text-center">
                <Link href={`/riders/${r.id}`} className="hover:text-[var(--accent)]">
                  {r.lastName}
                </Link>
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-center">{r.firstName}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-center text-[var(--text-dim)]">
                <span className="inline-flex items-center gap-1.5">
                  <Flag nationality={r.nationality} />
                  {r.nationality ?? "—"}
                </span>
              </td>
              {showTeamColumn && (
                <td className="whitespace-nowrap px-2 py-1.5 text-center text-[var(--text-dim)]">
                  {r.teamId ? (
                    <Link href={`/teams/${r.teamId}`} className="inline-flex items-center gap-1.5 hover:text-[var(--accent)]">
                      <TeamJersey jerseyUrl={r.teamJerseyUrl} color={r.teamColor} className="h-5 w-5 rounded" />
                      {r.teamName}
                    </Link>
                  ) : (
                    "Agent libre"
                  )}
                </td>
              )}
              <td className="px-2 py-1.5 text-center font-mono">{r.age ?? "—"}</td>
              <td className="px-2 py-1.5 text-center font-mono">{r.potential ?? "—"}</td>
              {STAT_COLUMNS.map((c) => (
                <td
                  key={c.key}
                  className="px-2 py-1.5 text-center font-mono text-black"
                  style={{ background: bandColor(r[c.key] as number | null) }}
                >
                  {(r[c.key] as number | null) ?? "—"}
                </td>
              ))}
              <td className="px-2 py-1.5 text-center font-mono text-black" style={{ background: bandColor(r.moyenne) }}>
                {r.moyenne?.toFixed(2) ?? "—"}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={colCount} className="px-4 py-6 text-center text-[var(--text-dim)]">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
