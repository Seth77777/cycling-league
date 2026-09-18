import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "fs";
import path from "path";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

const SEASON = 2;
const STAT_COLUMNS = ["statPl", "statMo", "statVal", "statClm", "statPrl", "statPav", "statSp", "statAcc", "statDes", "statBar", "statEnd", "statRes", "statRec"] as const;

// S2 name -> current (S4) team name, for teams renamed since (same aliases as the S3 import).
const TEAM_RENAMES: Record<string, string> = {
  "Aqua Blue Sport": "Team Sky",
  "Belize Cycling": "Japan Airlines - Giant",
  "Omega Pharma": "Eneco-Colruyt",
};

function parseIntOrNull(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = Number(raw.trim());
  return Number.isNaN(n) ? null : n;
}

function parseFloatFr(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = Number(raw.trim().replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function nameKey(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}

async function main() {
  const filePath = path.resolve(process.cwd(), "prisma/data/season2-riders.tsv");
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");

  const teams = await prisma.team.findMany();
  const teamByName = new Map(teams.map((t) => [t.name, t]));

  const existingRiders = await prisma.rider.findMany({
    include: { stints: { include: { team: true }, orderBy: { startSeason: "asc" } } },
  });
  const riderByName = new Map(existingRiders.map((r) => [nameKey(r.firstName, r.lastName), r]));

  let matchedSameTeam = 0;
  let matchedTransferred = 0;
  const newRiders: string[] = [];
  const unresolvedTeams = new Set<string>();

  for (const line of lines) {
    const cols = line.split("\t");
    const [lastName, firstName, , nationality, ageRaw, potentialRaw, ...rest] = cols;
    const stats = rest.slice(0, 13);
    const moyenneRaw = rest[13];
    const rawTeamName = rest[14]?.trim();
    if (!lastName || !firstName || !rawTeamName) {
      console.warn(`Skipping malformed line: ${line}`);
      continue;
    }

    const teamName = TEAM_RENAMES[rawTeamName] ?? rawTeamName;
    const team = teamByName.get(teamName);
    if (!team) {
      unresolvedTeams.add(rawTeamName);
      continue;
    }

    const existing = riderByName.get(nameKey(firstName, lastName));

    if (existing) {
      const earliestStint = existing.stints[0]; // stints already ordered by startSeason asc
      if (earliestStint && earliestStint.teamId === team.id) {
        if (earliestStint.startSeason > SEASON) {
          await prisma.teamStint.update({ where: { id: earliestStint.id }, data: { startSeason: SEASON } });
        }
        matchedSameTeam++;
      } else if (earliestStint) {
        const already = await prisma.teamStint.findFirst({ where: { riderId: existing.id, teamId: team.id, startSeason: SEASON } });
        if (!already) {
          await prisma.teamStint.create({
            data: { riderId: existing.id, teamId: team.id, startSeason: SEASON, endSeason: earliestStint.startSeason },
          });
        }
        matchedTransferred++;
      }
      continue;
    }

    // No later-season counterpart — this rider's career ends at S2 in our records.
    const statData: Record<string, number | null> = {};
    STAT_COLUMNS.forEach((key, i) => {
      statData[key] = parseIntOrNull(stats[i]);
    });

    const rider = await prisma.rider.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nationality: nationality?.trim() || null,
        age: parseIntOrNull(ageRaw),
        potential: parseIntOrNull(potentialRaw),
        moyenne: parseFloatFr(moyenneRaw),
        draftSeason: 0,
        retired: true,
        retirementSeason: SEASON,
        ...statData,
      },
    });
    await prisma.teamStint.create({
      data: { riderId: rider.id, teamId: team.id, startSeason: SEASON, endSeason: SEASON + 1 },
    });
    newRiders.push(`${firstName.trim()} ${lastName.trim()} (${teamName})`);
  }

  console.log(`Matched, same team at earliest known point: ${matchedSameTeam}`);
  console.log(`Matched, transferred into their earliest known team: ${matchedTransferred}`);
  console.log(`New S2-only riders created (marked retired, retirementSeason=${SEASON}): ${newRiders.length}`);
  if (newRiders.length > 0) console.log(newRiders.map((n) => `  - ${n}`).join("\n"));
  if (unresolvedTeams.size > 0) console.warn("Unresolved team names:", [...unresolvedTeams]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
