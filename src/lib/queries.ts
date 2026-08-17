import { prisma } from "@/lib/prisma";

export function fullName(r: { firstName: string; lastName: string }) {
  return `${r.firstName} ${r.lastName}`;
}

export async function listSeasons(): Promise<number[]> {
  const races = await prisma.race.findMany({ select: { season: true }, distinct: ["season"] });
  return races.map((r) => r.season).sort((a, b) => b - a);
}

export async function getRiderRankings(season?: number) {
  const results = await prisma.result.findMany({
    where: season ? { race: { season } } : undefined,
    include: { rider: true },
  });

  const byRider = new Map<
    string,
    { rider: (typeof results)[number]["rider"]; points: number; wins: number; podiums: number; races: number }
  >();

  for (const r of results) {
    const entry = byRider.get(r.riderId) ?? { rider: r.rider, points: 0, wins: 0, podiums: 0, races: 0 };
    entry.points += r.points;
    entry.races += 1;
    if (r.rank === 1) entry.wins += 1;
    if (r.rank <= 3) entry.podiums += 1;
    byRider.set(r.riderId, entry);
  }

  return [...byRider.values()].sort((a, b) => b.points - a.points || b.wins - a.wins);
}

export async function getTeamRankings(season?: number) {
  const results = await prisma.result.findMany({
    where: season ? { race: { season }, teamId: { not: null } } : { teamId: { not: null } },
    include: { team: true },
  });

  const byTeam = new Map<
    string,
    { team: NonNullable<(typeof results)[number]["team"]>; points: number; wins: number; podiums: number }
  >();

  for (const r of results) {
    if (!r.team) continue;
    const entry = byTeam.get(r.teamId!) ?? { team: r.team, points: 0, wins: 0, podiums: 0 };
    entry.points += r.points;
    if (r.rank === 1) entry.wins += 1;
    if (r.rank <= 3) entry.podiums += 1;
    byTeam.set(r.teamId!, entry);
  }

  return [...byTeam.values()].sort((a, b) => b.points - a.points || b.wins - a.wins);
}

export async function getRiderProfile(id: string) {
  const rider = await prisma.rider.findUnique({
    where: { id },
    include: {
      stints: { include: { team: true }, orderBy: { startDate: "asc" } },
      results: { include: { race: { include: { category: true } }, team: true }, orderBy: { race: { date: "desc" } } },
    },
  });
  if (!rider) return null;

  const currentStint = rider.stints.find((s) => s.endDate === null) ?? null;

  const bySeason = new Map<number, number>();
  for (const r of rider.results) {
    bySeason.set(r.race.season, (bySeason.get(r.race.season) ?? 0) + r.points);
  }
  const seasonPoints = [...bySeason.entries()].sort((a, b) => b[0] - a[0]);

  const wins = rider.results.filter((r) => r.rank === 1).length;
  const podiums = rider.results.filter((r) => r.rank <= 3).length;
  const top10 = rider.results.filter((r) => r.rank <= 10).length;

  return { rider, currentStint, seasonPoints, palmares: { wins, podiums, top10 } };
}

export async function getTeamDetail(id: string) {
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      stints: { include: { rider: true }, orderBy: { startDate: "asc" } },
    },
  });
  if (!team) return null;

  const current = team.stints.filter((s) => s.endDate === null);
  const past = team.stints.filter((s) => s.endDate !== null);

  return { team, current, past };
}

export async function getRaces(season?: number) {
  return prisma.race.findMany({
    where: season ? { season } : undefined,
    include: { category: true, _count: { select: { results: true } } },
    orderBy: { date: "asc" },
  });
}

export async function getRaceDetail(id: string) {
  const race = await prisma.race.findUnique({
    where: { id },
    include: {
      category: true,
      results: { include: { rider: true, team: true }, orderBy: { rank: "asc" } },
    },
  });
  return race;
}
