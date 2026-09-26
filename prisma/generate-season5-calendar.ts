import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { CALENDAR_TEMPLATE, GRAND_TOUR_STAGE_COUNT, GRAND_TOUR_JERSEYS, grandTourStageProfile } from "../src/lib/calendarTemplate";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

const SEASON = 5;

async function main() {
  const existing = await prisma.race.count({ where: { season: SEASON, resultKind: "race", parentRaceId: null } });
  if (existing > 0) throw new Error(`Le calendrier de la saison ${SEASON} existe déjà (${existing} courses).`);

  const [classique, grandTour] = await Promise.all([
    prisma.category.findUniqueOrThrow({ where: { name: "Classique" } }),
    prisma.category.findUniqueOrThrow({ where: { name: "Grand tour" } }),
  ]);

  for (const [i, entry] of CALENDAR_TEMPLATE.entries()) {
    const race = await prisma.race.create({
      data: {
        name: entry.name,
        country: entry.country,
        order: i + 1,
        season: SEASON,
        categoryId: (entry.grandTour ? grandTour : classique).id,
        logoUrl: entry.logoUrl ?? null,
        profileUrl: entry.profileUrl ?? null,
      },
    });

    if (entry.grandTour) {
      for (let n = 1; n <= GRAND_TOUR_STAGE_COUNT; n++) {
        await prisma.race.create({
          data: {
            name: `${entry.name} — Étape ${n}`,
            country: entry.country,
            season: SEASON,
            categoryId: grandTour.id,
            resultKind: "stage",
            parentRaceId: race.id,
            stageNumber: n,
            profileUrl: grandTourStageProfile(entry.name, n, SEASON),
          },
        });
      }

      for (const jerseyName of GRAND_TOUR_JERSEYS) {
        await prisma.race.create({
          data: {
            name: `${entry.name} — ${jerseyName}`,
            country: entry.country,
            season: SEASON,
            categoryId: grandTour.id,
            resultKind: "jersey",
            parentRaceId: race.id,
            jerseyName,
          },
        });
      }
    }
  }

  console.log(`Generated season ${SEASON} calendar: ${CALENDAR_TEMPLATE.length} races.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
