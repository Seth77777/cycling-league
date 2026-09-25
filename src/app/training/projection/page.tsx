import Link from "next/link";
import { getTeamsWithActiveRosters, getActiveRidersFlat, listSeasons } from "@/lib/queries";
import { TrainingProjection } from "@/components/TrainingProjection";

export default async function TrainingProjectionPage() {
  const currentSeason = (await listSeasons())[0] ?? 1;
  const [teams, riders] = await Promise.all([
    getTeamsWithActiveRosters(currentSeason),
    getActiveRidersFlat(currentSeason),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/training" className="mb-2 inline-block text-xs text-[var(--accent)] hover:underline">
            ← Entraînement
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text)]">Projection pluriannuelle</h1>
          <p className="text-sm text-[var(--text-dim)]">
            Planifie un entraînement par année jusqu&apos;à 30 ans, puis régression automatique ensuite — projection
            uniquement, aucune donnée n&apos;est modifiée.
          </p>
        </div>
        <Link
          href="/training/bareme"
          className="mt-6 whitespace-nowrap rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Barème →
        </Link>
      </div>
      <TrainingProjection teams={teams} riders={riders} />
    </div>
  );
}
