import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

const SEASON = 1;
const JOIN_SEASON = 2;

const TEAM_ALIASES: Record<string, string> = {
  Skoda: "Team Skoda",
  T1: "T1 Cycling",
  Omega: "Eneco-Colruyt",
  BN: "BN",
  Belize: "Japan Airlines - Giant",
  "T-Mobile": "T-Mobile - Bianchi",
  "New Balance": "New Balance",
  Holy: "Holy Cycling Team",
  Gatorade: "Gatorade",
  Aqua: "Team Sky",
  Cactus: "Team Cactus",
  RedBull: "RedBull Racing",
  "7-Eleven": "Team 7-Eleven",
  Venturi: "V pour Venturi",
  Gerolsteiner: "Gerolsteiner",
  "Quick Step": "Quick-Step Pulsar",
  RBK: "RBK Bank",
  Monster: "Monster Energy",
  Galp: "Galp Energia",
  Cinelli: "Cinelli Racing Team",
  Scottf: "Scott - Hilti", // typo in the source table for "Scott"
};

// [pick, lastName, firstName, teamLabel] — riders already exist via the season2-riders.tsv
// roster import; this only records how/when they entered the league. Pick 15 is genuinely
// absent from the source table (same as gaps in the S2 draft import), not a typo.
const PICKS: [number, string, string, string][] = [
  [1, "Stannard", "Morgan", "Skoda"],
  [2, "Van Serren", "Jelle", "T1"],
  [3, "Wyatt", "Bob", "Omega"],
  [4, "Beretti", "Francesco", "BN"],
  [5, "Oliveiro", "Rui", "Belize"],
  [6, "Coric", "Tomislav", "T-Mobile"],
  [7, "Gilbert", "Jean", "New Balance"],
  [8, "Gimenez", "Alejandro", "T-Mobile"],
  [9, "Sato", "Takumi", "Holy"],
  [10, "Malessen", "Ian", "Gatorade"],
  [11, "Mesmedov", "Vlad", "Aqua"],
  [12, "Olvado Costa", "Marco", "T1"],
  [13, "Mate", "Luis Miguel", "Cactus"],
  [14, "Sinic", "Emil", "RedBull"],
  [16, "Vermont", "Fabian", "7-Eleven"],
  [17, "Krutchuk", "Petr", "Venturi"],
  [18, "Milan", "Janez", "T1"],
  [19, "Capushov", "Ignael", "Gerolsteiner"],
  [20, "Ionescu", "Daniel", "Quick Step"],
  [21, "Jones", "James", "RBK"],
  [22, "Pizarello", "Giacopo", "Monster"],
  [23, "Jungels", "Marc", "Skoda"],
  [24, "Ignatiev", "Edgar", "Galp"],
  [25, "Yarmolenko", "Dmytro", "Belize"],
  [26, "Gudarsson", "Sirgud", "T-Mobile"],
  [27, "Van Seriguen", "Max", "New Balance"],
  [28, "Rotsberger", "Ralen", "Gatorade"],
  [29, "Shapalov", "Ignar", "Venturi"],
  [30, "Willson", "Lamar", "Cinelli"],
  [31, "Albero", "Fabian", "Venturi"],
  [32, "Pavachuk", "Volodimir", "Quick Step"],
  [33, "Erdin", "Recip", "Scottf"],
  [34, "Inana", "Ali", "RBK"],
];

async function main() {
  const teams = await prisma.team.findMany();
  const teamByName = new Map(teams.map((t) => [t.name, t]));

  let updated = 0;
  let starterStintsAdded = 0;
  const notFound: string[] = [];

  for (const [pick, lastName, firstName, teamLabel] of PICKS) {
    const rider = await prisma.rider.findFirst({
      where: { firstName, lastName },
      include: { stints: { where: { endSeason: null }, include: { team: true } } },
    });
    if (!rider) {
      notFound.push(`${firstName} ${lastName}`);
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
    } else if (!draftTeam) {
      console.warn(`Unresolved team "${teamLabel}" for ${firstName} ${lastName}`);
    }
  }

  console.log(`Updated ${updated} riders with draftSeason/draftPick.`);
  console.log(`Added ${starterStintsAdded} "drafted by" starter stints for riders transferred before the season.`);
  if (notFound.length > 0) console.warn("Not found:", notFound);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
