import Link from "next/link";
import { getTeamsWithActiveRosters, getActiveRidersFlat, getLatestSeason } from "@/lib/queries";
import { SingleSeasonTraining } from "@/components/SingleSeasonTraining";

export default async function TrainingPage() {
  const [teams, riders, latestSeason] = await Promise.all([
    getTeamsWithActiveRosters(),
    getActiveRidersFlat(),
    getLatestSeason(),
  ]);
  const nextSeason = latestSeason + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Entraînement — Saison {nextSeason}</h1>
          <p className="text-sm text-[var(--text-dim)]">
            Choisis l&apos;entraînement de chaque coureur pour la saison — projection uniquement, aucune donnée n&apos;est modifiée.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/training/bareme"
            className="whitespace-nowrap rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Barème →
          </Link>
          <Link
            href="/training/projection"
            className="whitespace-nowrap rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Projection pluriannuelle →
          </Link>
        </div>
      </div>
      <SingleSeasonTraining teams={teams} riders={riders} season={nextSeason} />
    </div>
  );
}
