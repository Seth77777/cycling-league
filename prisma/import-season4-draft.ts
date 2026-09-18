import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

const SEASON = 4;

// [lastName, firstName, pickNumber, draftTeamName]
const PICKS: [string, string, number, string][] = [
  ["Sabrel", "Esteban", 1, "Lampre"],
  ["Aijala", "Jarkko", 2, "V pour Venturi"],
  ["Ruiz Guerra", "Flaminio", 3, "Japan Airlines - Giant"],
  ["Garratt", "Jake", 4, "Quick-Step Pulsar"],
  ["Simon", "Arthur", 5, "Eneco-Colruyt"],
  ["Moore", "Weston", 6, "Team Skoda"],
  ["Vrammout", "Eli", 7, "Galp Energia"],
  ["Honders", "Daron", 8, "Lampre"],
  ["Laforge", "Gwendal", 9, "Team Cactus"],
  ["Tonnessen", "Daniel", 12, "Team 7-Eleven"],
  ["Porteinsson", "Benjamin", 13, "RedBull Racing"],
  ["Sandoval", "Casiano", 14, "Gatorade"],
  ["Kim", "Minseok", 16, "Eneco-Colruyt"],
  ["Palastophos", "Giorgios", 17, "T-Mobile - Bianchi"],
  ["Nassar", "Azhar Nuhaid", 18, "Scott - Hilti"],
  ["Kirvesniemi", "Maunu", 20, "V pour Venturi"],
  ["Lundin", "Agust", 21, "RBK Bank"],
];

async function main() {
  const teams = await prisma.team.findMany();
  const teamByName = new Map(teams.map((t) => [t.name, t]));

  let updated = 0;
  let starterStintsAdded = 0;

  for (const [lastName, firstName, pick, draftTeamName] of PICKS) {
    const rider = await prisma.rider.findFirst({
      where: { firstName, lastName },
      include: { stints: { where: { endSeason: null }, include: { team: true } } },
    });
    if (!rider) {
      console.warn(`Not found: ${firstName} ${lastName}`);
      continue;
    }

    await prisma.rider.update({
      where: { id: rider.id },
      data: { draftSeason: SEASON, draftPick: pick },
    });
    updated++;

    const draftTeam = teamByName.get(draftTeamName);
    const currentTeamId = rider.stints[0]?.teamId;
    if (draftTeam && currentTeamId && draftTeam.id !== currentTeamId) {
      // Drafted by draftTeam, transferred to their actual S4 team before the season started.
      await prisma.teamStint.create({
        data: { riderId: rider.id, teamId: draftTeam.id, startSeason: SEASON, endSeason: SEASON },
      });
      starterStintsAdded++;
      console.log(`${firstName} ${lastName}: drafted by ${draftTeamName}, transferred to ${rider.stints[0]?.team.name}`);
    }
  }

  console.log(`Updated ${updated} riders with draftSeason/draftPick.`);
  console.log(`Added ${starterStintsAdded} "drafted by" starter stints for riders who were transferred before the season.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
