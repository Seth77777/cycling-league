import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "fs";
import path from "path";

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

const SEASON = 5;
const PREV_SEASON = 4;
const STAT_COLUMNS = ["statPl", "statMo", "statVal", "statClm", "statPrl", "statPav", "statSp", "statAcc", "statDes", "statBar", "statEnd", "statRes", "statRec"] as const;

// The pasted S5 export uses a couple of team-name spellings that differ from our
// canonical Team.name — same convention as TEAM_RENAMES in import-season2/3.ts.
const TEAM_RENAMES: Record<string, string> = {
  "Cactus Team": "Team Cactus",
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
  const filePath = path.resolve(process.cwd(), "prisma/data/season5-riders.tsv");
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");

  const teams = await prisma.team.findMany();
  const teamByName = new Map(teams.map((t) => [t.name, t]));

  const allRiders = await prisma.rider.findMany({
    where: { unpickedSeason: null },
    include: { stints: true },
  });
  const riderByName = new Map(allRiders.map((r) => [nameKey(r.firstName, r.lastName), r]));

  const s5NameKeys = new Set<string>();
  let sameTeam = 0;
  let transferred = 0;
  const newRiders: string[] = [];
  const unresolvedTeams = new Set<string>();
  const unresolvedRows: string[] = [];

  for (const line of lines) {
    const cols = line.split("\t");
    const [lastName, firstName, nationality, ageRaw, potentialRaw, ...rest] = cols;
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
      unresolvedRows.push(`${firstName} ${lastName} -> "${rawTeamName}"`);
      continue;
    }

    s5NameKeys.add(nameKey(firstName, lastName));

    const statData: Record<string, number | null> = {};
    STAT_COLUMNS.forEach((key, i) => {
      statData[key] = parseIntOrNull(stats[i]);
    });
    const commonData = {
      nationality: nationality?.trim() || null,
      age: parseIntOrNull(ageRaw),
      potential: parseIntOrNull(potentialRaw),
      moyenne: parseFloatFr(moyenneRaw),
      ...statData,
    };

    const existing = riderByName.get(nameKey(firstName, lastName));

    if (existing) {
      await prisma.rider.update({ where: { id: existing.id }, data: commonData });

      const currentStint = existing.stints.find((s) => s.endSeason === null);
      if (currentStint && currentStint.teamId === team.id) {
        sameTeam++;
      } else {
        if (currentStint) {
          await prisma.teamStint.update({ where: { id: currentStint.id }, data: { endSeason: SEASON } });
        }
        const already = await prisma.teamStint.findFirst({ where: { riderId: existing.id, teamId: team.id, startSeason: SEASON } });
        if (already) {
          if (already.endSeason !== null) await prisma.teamStint.update({ where: { id: already.id }, data: { endSeason: null } });
        } else {
          await prisma.teamStint.create({ data: { riderId: existing.id, teamId: team.id, startSeason: SEASON, endSeason: null } });
        }
        transferred++;
      }
      continue;
    }

    // Name not found anywhere in our records — a genuinely new rider (the draft pool
    // should normally already cover every incoming player, so this should be rare).
    const rider = await prisma.rider.create({
      data: { firstName: firstName.trim(), lastName: lastName.trim(), draftSeason: PREV_SEASON, ...commonData },
    });
    await prisma.teamStint.create({ data: { riderId: rider.id, teamId: team.id, startSeason: SEASON, endSeason: null } });
    newRiders.push(`${firstName.trim()} ${lastName.trim()} (${teamName})`);
  }

  // Anyone who had an open S4 stint but doesn't appear anywhere in the S5 file retires.
  const retirees: string[] = [];
  for (const r of allRiders) {
    const currentStint = r.stints.find((s) => s.endSeason === null);
    if (!currentStint) continue;
    if (s5NameKeys.has(nameKey(r.firstName, r.lastName))) continue;
    await prisma.rider.update({ where: { id: r.id }, data: { retired: true, retirementSeason: PREV_SEASON } });
    await prisma.teamStint.update({ where: { id: currentStint.id }, data: { endSeason: SEASON } });
    retirees.push(`${r.firstName} ${r.lastName}`);
  }

  console.log(`Same team: ${sameTeam}`);
  console.log(`Transferred (or newly assigned from a recorded draft pick): ${transferred}`);
  console.log(`New riders created (not previously in our records): ${newRiders.length}`);
  if (newRiders.length > 0) console.log(newRiders.map((n) => `  - ${n}`).join("\n"));
  console.log(`Retired at end of S${PREV_SEASON}: ${retirees.length}`);
  if (retirees.length > 0) console.log(retirees.map((n) => `  - ${n}`).join("\n"));
  if (unresolvedTeams.size > 0) {
    console.warn("Unresolved team names:", [...unresolvedTeams]);
    console.warn(unresolvedRows.join("\n"));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
