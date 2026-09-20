import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { grandTourStageProfile } from "../src/lib/calendarTemplate";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

/**
 * Applies grandTourStageProfile() retroactively to already-created stages (S1-S4),
 * since generateSeasonCalendar only sets it going forward. Re-runnable at any time
 * as new profile images are added to GRAND_TOUR_STAGE_PROFILES — only touches rows
 * that are still empty and where the table now has a value.
 */
async function main() {
  const stages = await prisma.race.findMany({
    where: { resultKind: "stage", profileUrl: null, stageNumber: { not: null } },
    include: { parent: true },
  });

  let updated = 0;
  for (const stage of stages) {
    if (!stage.parent || stage.stageNumber == null) continue;
    const profileUrl = grandTourStageProfile(stage.parent.name, stage.stageNumber, stage.season);
    if (!profileUrl) continue;
    await prisma.race.update({ where: { id: stage.id }, data: { profileUrl } });
    updated++;
  }

  console.log(`Updated ${updated} stage(s) with a profile image.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
