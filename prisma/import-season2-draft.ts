import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

const SEASON = 2;
const JOIN_SEASON = 3;

const TEAM_ALIASES: Record<string, string> = {
  Skoda: "Team Skoda",
  "T1 Cycling": "T1 Cycling",
  "Quick Step": "Quick-Step Pulsar",
  Venturi: "V pour Venturi",
  Cinelli: "Cinelli Racing Team",
  Belize: "Japan Airlines - Giant",
  "Omega Pharma": "Eneco-Colruyt",
  Holy: "Holy Cycling Team",
  "Aqua Blue": "Team Sky",
  Galp: "Galp Energia",
  "T-Mobile": "T-Mobile - Bianchi",
  "7-Eleven": "Team 7-Eleven",
  Gerolsteiner: "Gerolsteiner",
  Scott: "Scott - Hilti",
  BN: "BN",
  Monster: "Monster Energy",
  "RBK Bank": "RBK Bank",
  Cactus: "Team Cactus",
  Redbull: "RedBull Racing",
  Lampre: "Lampre",
};

// [pick, lastName, firstName, teamLabel]
const PICKS: [number, string, string, string][] = [
  [1, "Hogerts", "Samuel", "Skoda"],
  [2, "Aguera Santos", "Manuel", "T1 Cycling"],
  [3, "Lamont", "Jesse", "Quick Step"],
  [4, "Mendoza", "Rigoberto", "Quick Step"],
  [5, "Malarsson", "Ignar", "Venturi"],
  [6, "Ignakov", "Alex", "Cinelli"],
  [7, "Tilk", "Aadu", "Belize"],
  [8, "Maes", "Louis", "Omega Pharma"],
  [10, "Flickenstone", "Harry", "Holy"],
  [11, "Carpole", "Andrea", "Aqua Blue"],
  [12, "Paora", "Rawiri", "Galp"],
  [13, "Doucouré", "Bienvenue", "T-Mobile"],
  [14, "Vakalin", "Alexei", "7-Eleven"],
  [15, "Bai", "Long Hu", "Gerolsteiner"],
  [16, "Montaignan", "Pierre", "Scott"],
  [17, "Vantaken", "Yuri", "Venturi"],
  [18, "Peeters", "Noah", "BN"],
  [19, "Janez Salvio", "Ernesto", "Omega Pharma"],
  [20, "Driscoll", "Stewart", "Monster"],
  [21, "Eddy", "Irvin", "RBK Bank"],
  [23, "Lauda", "Helmut", "Skoda"],
  [24, "Harris", "William", "Aqua Blue"],
  [26, "Filouski", "Robert", "Cactus"],
  [27, "Bertillono", "Francesco", "Redbull"],
  [28, "Kestec", "Jan", "Cinelli"],
  [29, "Makekaren", "Hamari", "Redbull"],
  [30, "Baumgartner", "Bastian", "Lampre"],
];

async function main() {
  const teams = await prisma.team.findMany();
  const teamByName = new Map(teams.map((t) => [t.name, t]));

  let updated = 0;
  let starterStintsAdded = 0;

  for (const [pick, lastName, firstName, teamLabel] of PICKS) {
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

    const draftTeamName = TEAM_ALIASES[teamLabel] ?? teamLabel;
    const draftTeam = teamByName.get(draftTeamName);
    const currentTeamId = rider.stints[0]?.teamId;
    if (draftTeam && currentTeamId && draftTeam.id !== currentTeamId) {
      await prisma.teamStint.create({
        data: { riderId: rider.id, teamId: draftTeam.id, startSeason: JOIN_SEASON, endSeason: JOIN_SEASON },
      });
      starterStintsAdded++;
      console.log(`${firstName} ${lastName}: drafted by ${draftTeamName}, transferred to ${rider.stints[0]?.team.name}`);
    }
  }

  // Retiree corrections confirmed by the user: pick 19 replaces Van Kinkel, not "Pilov" as literally
  // written (typo in the source table); pick 10's "Muller" is Heinrich Muller (Holy Cycling Team),
  // disambiguated from the unrelated existing Bastian Muller. Both were already correctly recorded
  // as retired (retirementSeason=2) during the season-2 roster import — no DB change needed here.
  // Pick 16's retiree "Valanciunas" has no record yet — skipped until that rider's data is provided.

  console.log(`Updated ${updated} riders with draftSeason/draftPick.`);
  console.log(`Added ${starterStintsAdded} "drafted by" starter stints for riders transferred before the season.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
