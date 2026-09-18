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

async function importUnpicked(season: number, fileName: string) {
  const filePath = path.resolve(process.cwd(), "prisma/data", fileName);
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");

  let created = 0;
  for (const line of lines) {
    const cols = line.split("\t");
    const [lastName, firstName, , nationality, ageRaw, potentialRaw, ...rest] = cols;
    const stats = rest.slice(0, 13);
    const moyenneRaw = rest[13];
    if (!lastName || !firstName) {
      console.warn(`Skipping malformed line: ${line}`);
      continue;
    }

    const existing = await prisma.rider.findFirst({ where: { firstName: firstName.trim(), lastName: lastName.trim() } });
    if (existing) {
      console.warn(`Already exists, skipping: ${firstName} ${lastName}`);
      continue;
    }

    const statData: Record<string, number | null> = {};
    STAT_COLUMNS.forEach((key, i) => {
      statData[key] = parseIntOrNull(stats[i]);
    });

    await prisma.rider.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nationality: nationality?.trim() || null,
        age: parseIntOrNull(ageRaw),
        potential: parseIntOrNull(potentialRaw),
        moyenne: parseFloatFr(moyenneRaw),
        draftSeason: 0,
        unpickedSeason: season,
        ...statData,
      },
    });
    created++;
  }
  console.log(`Season ${season} (${fileName}): created ${created} unpicked prospects.`);
}

async function main() {
  await importUnpicked(3, "season3-draft-unpicked.tsv");
  await importUnpicked(2, "season2-draft-unpicked.tsv");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
