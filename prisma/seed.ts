import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding categories…");

  await prisma.category.create({
    data: {
      name: "Classique",
      kind: "simple",
      pointsByRank: JSON.stringify([200, 150, 100, 80, 65, 50, 40, 30, 20, 10]),
    },
  });

  await prisma.category.create({
    data: {
      name: "Grand tour",
      kind: "grand-tour",
      stagePointsByRank: JSON.stringify([80, 60, 40, 30, 15]),
      stageTtMultiplier: 3,
      generalPointsByRank: JSON.stringify([400, 300, 230, 200, 150, 120, 100, 70, 50, 30]),
      jerseyPointsByRank: JSON.stringify([120, 70, 30]),
    },
  });

  console.log("Seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
