import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { CALENDAR_TEMPLATE } from "../src/lib/calendarTemplate";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

/**
 * Applies each Grand Tour's logoUrl (from CALENDAR_TEMPLATE) retroactively to
 * already-created GT hub races, since generateSeasonCalendar only sets it going
 * forward. Re-runnable: only touches rows still missing a logoUrl.
 */
async function main() {
  const logoByName = new Map(CALENDAR_TEMPLATE.filter((e) => e.grandTour && e.logoUrl).map((e) => [e.name, e.logoUrl!]));

  const hubs = await prisma.race.findMany({
    where: { resultKind: "race", parentRaceId: null, logoUrl: null, name: { in: [...logoByName.keys()] } },
  });

  let updated = 0;
  for (const hub of hubs) {
    const logoUrl = logoByName.get(hub.name);
    if (!logoUrl) continue;
    await prisma.race.update({ where: { id: hub.id }, data: { logoUrl } });
    updated++;
  }

  console.log(`Updated ${updated} Grand Tour hub(s) with a logo.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
