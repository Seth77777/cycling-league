import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "fs";
import path from "path";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

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

function nameKey(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}

async function backfill(season: number, fileName: string) {
  const filePath = path.resolve(process.cwd(), "prisma/data", fileName);
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");

  const allRiders = await prisma.rider.findMany();
  const riderByName = new Map(allRiders.map((r) => [nameKey(r.firstName, r.lastName), r]));

  let created = 0;
  let skipped = 0;
  for (const line of lines) {
    const cols = line.split("\t");
    const [lastName, firstName, , , ageRaw, potentialRaw, ...rest] = cols;
    const stats = rest.slice(0, 13);
    const moyenneRaw = rest[13];
    if (!lastName || !firstName) continue;

    const rider = riderByName.get(nameKey(firstName, lastName));
    if (!rider) {
      skipped++;
      console.warn(`Not found: ${firstName} ${lastName}`);
      continue;
    }

    const already = await prisma.riderSeasonStats.findUnique({ where: { riderId_season: { riderId: rider.id, season } } });
    if (already) continue;

    const statData: Record<string, number | null> = {};
    STAT_COLUMNS.forEach((key, i) => {
      statData[key] = parseIntOrNull(stats[i]);
    });

    await prisma.riderSeasonStats.create({
      data: {
        riderId: rider.id,
        season,
        age: parseIntOrNull(ageRaw),
        potential: parseIntOrNull(potentialRaw),
        moyenne: parseFloatFr(moyenneRaw),
        ...statData,
      },
    });
    created++;
  }
  console.log(`Season ${season} (${fileName}): archived ${created} snapshots, ${skipped} riders not found.`);
}

async function main() {
  await backfill(2, "season2-riders.tsv");
  await backfill(3, "season3-riders.tsv");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
