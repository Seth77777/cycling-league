import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { GRAND_TOUR_JERSEYS } from "../src/lib/calendarTemplate";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

/**
 * Adds the 3 standard Grand Tour jersey races (Montagne, Sprint, U25) to every
 * already-generated Grand Tour that doesn't have them yet, since
 * generateSeasonCalendar only creates them going forward. Re-runnable: skips a
 * jersey name that already exists under a given GT hub.
 */
async function main() {
  const grandTours = await prisma.race.findMany({
    where: { resultKind: "race", parentRaceId: null, category: { kind: "grand-tour" } },
    include: { children: { where: { resultKind: "jersey" } } },
  });

  let created = 0;
  for (const gt of grandTours) {
    const existing = new Set(gt.children.map((c) => c.jerseyName));
    for (const jerseyName of GRAND_TOUR_JERSEYS) {
      if (existing.has(jerseyName)) continue;
      await prisma.race.create({
        data: {
          name: `${gt.name} — ${jerseyName}`,
          country: gt.country,
          season: gt.season,
          categoryId: gt.categoryId,
          resultKind: "jersey",
          parentRaceId: gt.id,
          jerseyName,
        },
      });
      created++;
    }
  }

  console.log(`Created ${created} jersey race(s) across ${grandTours.length} Grand Tour(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
