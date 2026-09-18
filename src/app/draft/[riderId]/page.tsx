import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Flag } from "@/components/Flag";
import { RiderEvolutionTable } from "@/components/TrainingProjection";
import type { RiderRow } from "@/components/RidersStatsTable";

export default async function DraftRiderTrainingPage({ params }: { params: Promise<{ riderId: string }> }) {
  const { riderId } = await params;
  const rider = await prisma.rider.findUnique({ where: { id: riderId } });

  // Only prospects still in the draft pool (eligible, not yet picked) get this page —
  // once a team has drafted them, their real projection tool is the roster-based one.
  if (!rider || rider.draftSeason === 0 || rider.draftPick !== null) notFound();

  const row: RiderRow = {
    id: rider.id,
    lastName: rider.lastName,
    firstName: rider.firstName,
    nationality: rider.nationality,
    retired: rider.retired,
    age: rider.age,
    potential: rider.potential,
    moyenne: rider.moyenne,
    teamName: null,
    teamId: null,
    statPl: rider.statPl, statMo: rider.statMo, statVal: rider.statVal, statClm: rider.statClm,
    statPrl: rider.statPrl, statPav: rider.statPav, statSp: rider.statSp, statAcc: rider.statAcc,
    statDes: rider.statDes, statBar: rider.statBar, statEnd: rider.statEnd, statRes: rider.statRes, statRec: rider.statRec,
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/draft?season=${rider.draftSeason}`} className="mb-2 inline-block text-xs text-[var(--accent)] hover:underline">
          ← Draft
        </Link>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-[var(--text)]">
          <Flag nationality={rider.nationality} className="inline-block h-5 w-7 shrink-0 rounded-sm object-cover" />
          {rider.firstName} {rider.lastName}
        </h1>
        <p className="text-sm text-[var(--text-dim)]">
          Projection pluriannuelle — coureur disponible dans la draft, pas encore sélectionné.
        </p>
      </div>

      <RiderEvolutionTable rider={row} />
    </div>
  );
}
