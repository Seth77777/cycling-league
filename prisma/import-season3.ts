import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "fs";
import path from "path";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

const SEASON = 3;
const NEXT_SEASON = 4; // known team from this import cycle
const STAT_COLUMNS = ["statPl", "statMo", "statVal", "statClm", "statPrl", "statPav", "statSp", "statAcc", "statDes", "statBar", "statEnd", "statRes", "statRec"] as const;

// S3 name -> current (S4) team name, for teams that were renamed between seasons.
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
  const filePath = path.resolve(process.cwd(), "prisma/data/season3-riders.tsv");
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");

  const teams = await prisma.team.findMany();
  const teamByName = new Map(teams.map((t) => [t.name, t]));

  const existingRiders = await prisma.rider.findMany({
    include: { stints: { where: { endSeason: null }, include: { team: true } } },
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
      const currentStint = existing.stints[0];
      if (currentStint && currentStint.teamId === team.id) {
        // Same team in S3 and S4 — just extend the existing stint back to season 3.
        if (currentStint.startSeason > SEASON) {
          await prisma.teamStint.update({ where: { id: currentStint.id }, data: { startSeason: SEASON } });
        }
        matchedSameTeam++;
      } else {
        // Different team — genuine transfer between S3 and S4.
        const already = await prisma.teamStint.findFirst({ where: { riderId: existing.id, teamId: team.id, startSeason: SEASON } });
        if (!already) {
          await prisma.teamStint.create({
            data: { riderId: existing.id, teamId: team.id, startSeason: SEASON, endSeason: NEXT_SEASON },
          });
        }
        matchedTransferred++;
      }
      continue;
    }

    // No S4 counterpart — a rider whose career ends at S3 in our records.
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
        retirementSeason: NEXT_SEASON,
        ...statData,
      },
    });
    await prisma.teamStint.create({
      data: { riderId: rider.id, teamId: team.id, startSeason: SEASON, endSeason: NEXT_SEASON },
    });
    newRiders.push(`${firstName.trim()} ${lastName.trim()} (${teamName})`);
  }

  console.log(`Matched, same team in S3/S4: ${matchedSameTeam}`);
  console.log(`Matched, transferred between S3 and S4: ${matchedTransferred}`);
  console.log(`New S3-only riders created (marked retired, retirementSeason=${NEXT_SEASON}): ${newRiders.length}`);
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
