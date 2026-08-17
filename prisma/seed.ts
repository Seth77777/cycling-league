import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding…");

  const [tempest, granite, solara] = await Promise.all([
    prisma.team.create({ data: { name: "Tempest Racing", country: "Belgium", color: "#3b82f6" } }),
    prisma.team.create({ data: { name: "Granite Cycling", country: "Italy", color: "#6b7280" } }),
    prisma.team.create({ data: { name: "Solara Pro Team", country: "Spain", color: "#f59e0b" } }),
  ]);

  const [monument, stageRace, classic, minor] = await Promise.all([
    prisma.category.create({ data: { name: "Monument", pointsByRank: JSON.stringify([100, 80, 65, 50, 40, 30, 25, 20, 15, 10]) } }),
    prisma.category.create({ data: { name: "Major Stage Race", pointsByRank: JSON.stringify([120, 95, 75, 60, 50, 40, 32, 26, 20, 15]) } }),
    prisma.category.create({ data: { name: "Classic", pointsByRank: JSON.stringify([60, 50, 40, 32, 26, 20, 16, 12, 8, 5]) } }),
    prisma.category.create({ data: { name: "Minor Race", pointsByRank: JSON.stringify([25, 20, 16, 12, 10, 8, 6, 4, 2, 1]) } }),
  ]);

  const riderData = [
    { firstName: "Lars", lastName: "Vandenberg", nationality: "Belgium", team: tempest },
    { firstName: "Mateo", lastName: "Rossi", nationality: "Italy", team: granite },
    { firstName: "Diego", lastName: "Fuentes", nationality: "Spain", team: solara },
    { firstName: "Jonas", lastName: "Willems", nationality: "Belgium", team: tempest },
    { firstName: "Enzo", lastName: "Marchetti", nationality: "Italy", team: granite },
    { firstName: "Pablo", lastName: "Ibarra", nationality: "Spain", team: solara },
    { firstName: "Tomas", lastName: "Declercq", nationality: "Belgium", team: tempest },
    { firstName: "Luca", lastName: "Bianchi", nationality: "Italy", team: granite },
    { firstName: "Alvaro", lastName: "Serrano", nationality: "Spain", team: solara },
    { firstName: "Kobe", lastName: "Peeters", nationality: "Belgium", team: tempest },
  ];

  const riders = [];
  for (const rd of riderData) {
    const rider = await prisma.rider.create({
      data: { firstName: rd.firstName, lastName: rd.lastName, nationality: rd.nationality },
    });
    await prisma.teamStint.create({
      data: { riderId: rider.id, teamId: rd.team.id, startDate: new Date("2024-01-01") },
    });
    riders.push({ ...rider, team: rd.team });
  }

  // Give one rider a mid-career transfer so team history has a real example.
  const [transferee] = riders;
  await prisma.teamStint.updateMany({
    where: { riderId: transferee.id, endDate: null },
    data: { endDate: new Date("2025-01-01") },
  });
  await prisma.teamStint.create({
    data: { riderId: transferee.id, teamId: solara.id, startDate: new Date("2025-01-01") },
  });

  const races = [
    { name: "Spring Monument Classic", date: new Date("2024-04-07"), season: 2024, category: monument },
    { name: "Grand Tour de Continent", date: new Date("2024-07-14"), season: 2024, category: stageRace },
    { name: "Coastal Classic", date: new Date("2024-09-01"), season: 2024, category: classic },
    { name: "Spring Monument Classic", date: new Date("2025-04-06"), season: 2025, category: monument },
    { name: "Season Opener Criterium", date: new Date("2025-02-15"), season: 2025, category: minor },
  ];

  for (const r of races) {
    const race = await prisma.race.create({
      data: { name: r.name, date: r.date, season: r.season, categoryId: r.category.id },
    });
    const scale: number[] = JSON.parse(r.category.pointsByRank);
    // Shuffle riders for a varied, deterministic-ish finishing order per race.
    const order = [...riders].sort(() => 0.5 - Math.sin(race.name.length + r.date.getTime()));
    for (let i = 0; i < Math.min(order.length, scale.length); i++) {
      const rider = order[i];
      const currentTeam =
        r.season === 2025 && rider.id === transferee.id ? solara : rider.team;
      await prisma.result.create({
        data: {
          raceId: race.id,
          riderId: rider.id,
          teamId: currentTeam.id,
          rank: i + 1,
          points: scale[i],
        },
      });
    }
  }

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
