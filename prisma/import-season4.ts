import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "fs";
import path from "path";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

const SEASON = 4;
const STAT_COLUMNS = ["statPl", "statMo", "statVal", "statClm", "statPrl", "statPav", "statSp", "statAcc", "statDes", "statBar", "statEnd", "statRes", "statRec"] as const;

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

async function main() {
  const filePath = path.resolve(process.cwd(), "prisma/data/season4-riders.tsv");
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");

  console.log(`Importing ${lines.length} riders for season ${SEASON}…`);

  const teamCache = new Map<string, string>(); // name -> id
  let missingStatCount = 0;

  for (const line of lines) {
    const cols = line.split("\t");
    const [lastName, firstName, , nationality, ageRaw, potentialRaw, ...rest] = cols;
    const stats = rest.slice(0, 13);
    const moyenneRaw = rest[13];
    const teamName = rest[14]?.trim();

    if (!lastName || !firstName || !teamName) {
      console.warn(`Skipping malformed line: ${line}`);
      continue;
    }

    let teamId = teamCache.get(teamName);
    if (!teamId) {
      const team = await prisma.team.upsert({
        where: { name: teamName },
        update: {},
        create: { name: teamName },
      });
      teamId = team.id;
      teamCache.set(teamName, teamId);
    }

    const statData: Record<string, number | null> = {};
    STAT_COLUMNS.forEach((key, i) => {
      const val = parseIntOrNull(stats[i]);
      if (val === null) missingStatCount++;
      statData[key] = val;
    });

    const rider = await prisma.rider.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nationality: nationality?.trim() || null,
        age: parseIntOrNull(ageRaw),
        potential: parseIntOrNull(potentialRaw),
        moyenne: parseFloatFr(moyenneRaw),
        ...statData,
      },
    });

    await prisma.teamStint.create({
      data: { riderId: rider.id, teamId, startSeason: SEASON, endSeason: null },
    });
  }

  console.log(`Done. ${teamCache.size} teams, ${lines.length} riders imported for season ${SEASON}.`);
  if (missingStatCount > 0) console.warn(`${missingStatCount} stat value(s) were blank in the source data and left null.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
