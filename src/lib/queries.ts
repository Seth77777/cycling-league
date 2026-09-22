import { prisma } from "@/lib/prisma";
import type { Rider } from "@/generated/prisma";
import type { RiderRow } from "@/components/RidersStatsTable";
import { GRAND_TOUR_STAGE_COUNT } from "@/lib/calendarTemplate";

export function fullName(r: { firstName: string; lastName: string }) {
  return `${r.firstName} ${r.lastName}`;
}

function riderToRow(r: Rider, teamName: string | null, teamId: string | null): RiderRow {
  return {
    id: r.id, lastName: r.lastName, firstName: r.firstName, nationality: r.nationality,
    retired: r.retired, age: r.age, potential: r.potential, moyenne: r.moyenne,
    teamName, teamId,
    statPl: r.statPl, statMo: r.statMo, statVal: r.statVal, statClm: r.statClm,
    statPrl: r.statPrl, statPav: r.statPav, statSp: r.statSp, statAcc: r.statAcc,
    statDes: r.statDes, statBar: r.statBar, statEnd: r.statEnd, statRes: r.statRes, statRec: r.statRec,
  };
}

export interface TeamRosterGroup {
  id: string;
  name: string;
  color: string | null;
  riders: RiderRow[];
}

/** Every team's current (endSeason === null) roster — for the team-by-team training view. */
export async function getTeamsWithActiveRosters(): Promise<TeamRosterGroup[]> {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { stints: { where: { endSeason: null }, include: { rider: true } } },
  });

  return teams
    .map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      riders: t.stints
        .map((s) => s.rider)
        .filter((r) => !r.retired)
        .sort((a, b) => a.lastName.localeCompare(b.lastName))
        .map((r) => riderToRow(r, t.name, t.id)),
    }))
    .filter((t) => t.riders.length > 0);
}

/** All currently rostered, non-retired riders across every team — for the individual simulator's search. */
export async function getActiveRidersFlat(): Promise<RiderRow[]> {
  const stints = await prisma.teamStint.findMany({
    where: { endSeason: null },
    include: { rider: true, team: true },
  });
  return stints
    .filter((s) => !s.rider.retired)
    .map((s) => riderToRow(s.rider, s.team.name, s.team.id))
    .sort((a, b) => a.lastName.localeCompare(b.lastName));
}

export async function listSeasons(): Promise<number[]> {
  const races = await prisma.race.findMany({ select: { season: true }, distinct: ["season"] });
  return races.map((r) => r.season).sort((a, b) => b - a);
}

/** Best-guess "current" season for form defaults — highest season seen across races or team stints. */
export async function getLatestSeason(): Promise<number> {
  const [race, stint] = await Promise.all([
    prisma.race.findFirst({ orderBy: { season: "desc" }, select: { season: true } }),
    prisma.teamStint.findFirst({ orderBy: { startSeason: "desc" }, select: { startSeason: true } }),
  ]);
  return Math.max(race?.season ?? 1, stint?.startSeason ?? 1);
}

export async function getRiderRankings(season?: number) {
  const results = await prisma.result.findMany({
    where: {
      ...(season ? { race: { season } } : {}),
      NOT: { team: { excludeFromRankings: true } },
    },
    include: { rider: true, team: true, race: { select: { isTeamTimeTrial: true } } },
    // Ascending so the last result processed per rider is their most recent race —
    // used below to show the team they were riding for most recently in this ranking.
    orderBy: [{ race: { season: "asc" } }, { race: { order: "asc" } }],
  });

  const byRider = new Map<
    string,
    {
      rider: (typeof results)[number]["rider"];
      team: (typeof results)[number]["team"];
      points: number;
      wins: number;
      podiums: number;
      races: number;
    }
  >();

  for (const r of results) {
    const entry = byRider.get(r.riderId) ?? { rider: r.rider, team: r.team, points: 0, wins: 0, podiums: 0, races: 0 };
    // Team time trial points count only toward the team ranking, never the individual
    // one — but a rider still keeps their win/podium credit and race count for it.
    if (!r.race.isTeamTimeTrial) entry.points += r.points;
    entry.races += 1;
    if (r.rank === 1) entry.wins += 1;
    if (r.rank <= 3) entry.podiums += 1;
    entry.team = r.team ?? entry.team;
    byRider.set(r.riderId, entry);
  }

  return [...byRider.values()].sort((a, b) => b.points - a.points || b.wins - a.wins);
}

interface ReputationResult {
  rank: number;
  points: number;
  race: { season: number; resultKind: string; category: { kind: string } };
}

/**
 * A 0.5-5 star "reputation" built from career achievements, in half-star steps.
 * Anchors: 0.5 base, 1 once they've scored any points, 4.5 for multiple wins plus
 * more than one top-20 season-end finish, 5 for a top-10 season-end finish, a
 * Grand Tour GC win, several distinctive jerseys, or 5+ classic wins. The steps in
 * between scale through consistency (scoring in several races, not just once —
 * scoring at all already implies a near-top-10 finish, so "top 10 once" wouldn't
 * add anything), podiums/wins, and season-end ranking.
 */
export async function computeReputation(riderId: string, results: ReputationResult[]): Promise<number> {
  const careerPoints = results.reduce((sum, r) => sum + r.points, 0);
  if (results.length === 0 || careerPoints <= 0) return 0.5;

  const wins = results.filter((r) => r.rank === 1);
  const podiums = results.filter((r) => r.rank <= 3);
  const scoringRaces = results.filter((r) => r.points > 0);

  const gtWin = wins.some((r) => r.race.resultKind === "race" && r.race.category.kind === "grand-tour");
  const jerseyWins = wins.filter((r) => r.race.resultKind === "jersey").length;
  const classicWins = wins.filter((r) => r.race.resultKind === "race" && r.race.category.kind === "simple").length;

  // Season-end ranking only counts for seasons that have actually finished — the
  // current (latest) season is still being played, so an early lead there hasn't
  // "finished" top-10/20 anything yet, no matter how good it looks mid-season.
  const latestSeason = await getLatestSeason();
  const finishedSeasons = [...new Set(results.map((r) => r.race.season))].filter((s) => s < latestSeason);
  let bestSeasonRank = Infinity;
  let top20Seasons = 0;
  for (const season of finishedSeasons) {
    const rankings = await getRiderRankings(season);
    const idx = rankings.findIndex((r) => r.rider.id === riderId);
    if (idx === -1) continue;
    const rank = idx + 1;
    if (rank < bestSeasonRank) bestSeasonRank = rank;
    if (rank <= 20) top20Seasons++;
  }

  if (bestSeasonRank <= 10 || gtWin || jerseyWins >= 2 || classicWins >= 5) return 5;
  if (wins.length >= 2 && top20Seasons >= 2) return 4.5;
  if (wins.length >= 3 || podiums.length >= 5 || bestSeasonRank <= 15) return 4;
  if (wins.length >= 2 || podiums.length >= 3) return 3.5;
  if (top20Seasons >= 1) return 3;
  if (wins.length >= 1) return 2.5;
  if (podiums.length >= 1) return 2;
  if (scoringRaces.length >= 3) return 1.5;
  return 1;
}

/**
 * Averages a team's current riders' reputations, skewed a little toward the top —
 * each rider's weight is √(their reputation) — so a standout captain lifts the
 * team's rating a bit more than a plain average would, without one ace fully
 * carrying a squad of newcomers.
 */
function weightedTeamReputation(values: number[]): number {
  if (values.length === 0) return 0;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const v of values) {
    const w = Math.sqrt(v);
    weightedSum += v * w;
    weightTotal += w;
  }
  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

/** Teams list with each team's current roster reduced to a single star rating (see `weightedTeamReputation`). */
export async function getTeamsOverview() {
  const teams = await prisma.team.findMany({
    include: {
      stints: {
        where: { endSeason: null },
        include: { rider: { include: { results: { include: { race: { include: { category: true } } } } } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    teams.map(async (team) => {
      const reputations = await Promise.all(team.stints.map((s) => computeReputation(s.riderId, s.rider.results)));
      return { ...team, reputation: weightedTeamReputation(reputations) };
    }),
  );
}

export async function getTeamRankings(season?: number) {
  const results = await prisma.result.findMany({
    where: {
      teamId: { not: null },
      NOT: { team: { excludeFromRankings: true } },
      ...(season ? { race: { season } } : {}),
    },
    include: { team: true },
  });

  const byTeam = new Map<
    string,
    { team: NonNullable<(typeof results)[number]["team"]>; points: number; wins: number; podiums: number }
  >();
  // A win/podium counts once per race for the TEAM, no matter how many of its riders
  // individually placed there — matters for a team time trial (several riders share
  // the winning rank) but is a correct rule generally too (e.g. two team-mates on
  // the same podium shouldn't double the team's podium tally).
  const wonRaces = new Map<string, Set<string>>();
  const podiumRaces = new Map<string, Set<string>>();

  for (const r of results) {
    if (!r.team) continue;
    const entry = byTeam.get(r.teamId!) ?? { team: r.team, points: 0, wins: 0, podiums: 0 };
    entry.points += r.points;
    if (r.rank === 1) {
      const races = wonRaces.get(r.teamId!) ?? new Set<string>();
      if (!races.has(r.raceId)) { entry.wins += 1; races.add(r.raceId); wonRaces.set(r.teamId!, races); }
    }
    if (r.rank <= 3) {
      const races = podiumRaces.get(r.teamId!) ?? new Set<string>();
      if (!races.has(r.raceId)) { entry.podiums += 1; races.add(r.raceId); podiumRaces.set(r.teamId!, races); }
    }
    byTeam.set(r.teamId!, entry);
  }

  return [...byTeam.values()].sort((a, b) => b.points - a.points || b.wins - a.wins);
}

export async function getNationRankings(season?: number) {
  const results = await prisma.result.findMany({
    where: {
      ...(season ? { race: { season } } : {}),
      NOT: { team: { excludeFromRankings: true } },
    },
    include: { rider: true },
  });

  const byNation = new Map<string, { nationality: string; points: number; wins: number; podiums: number }>();

  for (const r of results) {
    const nationality = r.rider.nationality;
    if (!nationality) continue;
    const entry = byNation.get(nationality) ?? { nationality, points: 0, wins: 0, podiums: 0 };
    entry.points += r.points;
    if (r.rank === 1) entry.wins += 1;
    if (r.rank <= 3) entry.podiums += 1;
    byNation.set(nationality, entry);
  }

  return [...byNation.values()].sort((a, b) => b.points - a.points || b.wins - a.wins);
}

export async function getRiderProfile(id: string) {
  const [rider, latestSeason] = await Promise.all([
    prisma.rider.findUnique({
      where: { id },
      include: {
        // When two stints share a startSeason (e.g. drafted by one team, immediately
        // transferred before the season played out), the closed one is the earlier fact.
        stints: { include: { team: true }, orderBy: [{ startSeason: "asc" }, { endSeason: { sort: "asc", nulls: "last" } }] },
        results: {
          include: { race: { include: { category: true } }, team: true },
          orderBy: [{ race: { season: "desc" } }, { race: { order: "desc" } }],
        },
        seasonStats: { orderBy: { season: "desc" } },
      },
    }),
    getLatestSeason(),
  ]);
  if (!rider) return null;

  const currentStint = rider.stints.find((s) => s.endSeason === null) ?? null;

  const bySeason = new Map<number, number>();
  for (const r of rider.results) {
    if (r.race.isTeamTimeTrial) continue;
    bySeason.set(r.race.season, (bySeason.get(r.race.season) ?? 0) + r.points);
  }
  const seasonPoints = [...bySeason.entries()].sort((a, b) => b[0] - a[0]);

  const wins = rider.results.filter((r) => r.rank === 1).length;
  const podiums = rider.results.filter((r) => r.rank <= 3).length;
  const top10 = rider.results.filter((r) => r.rank <= 10).length;
  const reputation = await computeReputation(rider.id, rider.results);

  // The season whose stats are shown as "current" — the rider's last active season if
  // retired, otherwise the league's latest season. Earlier archived seasons go in the spoiler.
  const currentStatsSeason = rider.retired && rider.retirementSeason != null ? rider.retirementSeason : latestSeason;
  const pastSeasonStats = rider.seasonStats.filter((s) => s.season !== currentStatsSeason);

  return { rider, currentStint, seasonPoints, palmares: { wins, podiums, top10 }, reputation, currentStatsSeason, pastSeasonStats };
}

/** Team roster as it stood in a given season (or the current roster if season is omitted). */
/**
 * Team roster as it stood in a given season, with each rider's stats as they were
 * that season — not their current stats — for any season before their "current"
 * one (the league's latest season, or their retirement season if retired). The
 * Rider row only ever holds current values; earlier seasons come from the
 * RiderSeasonStats archive (see schema.prisma), when a snapshot was imported.
 */
export async function getTeamDetail(id: string, season?: number) {
  const [team, latestSeason] = await Promise.all([
    prisma.team.findUnique({
      where: { id },
      include: {
        stints: { include: { rider: true }, orderBy: [{ startSeason: "asc" }, { endSeason: { sort: "asc", nulls: "last" } }] },
      },
    }),
    getLatestSeason(),
  ]);
  if (!team) return null;

  const roster =
    season != null
      ? team.stints.filter((s) => s.startSeason <= season && (s.endSeason === null || s.endSeason > season))
      : team.stints.filter((s) => s.endSeason === null);

  let rosterForDisplay = roster;
  if (season != null) {
    const pastRiderIds = roster
      .filter((s) => season !== (s.rider.retired && s.rider.retirementSeason != null ? s.rider.retirementSeason : latestSeason))
      .map((s) => s.riderId);
    const snapshots = pastRiderIds.length
      ? await prisma.riderSeasonStats.findMany({ where: { riderId: { in: pastRiderIds }, season } })
      : [];
    const byRiderId = new Map(snapshots.map((s) => [s.riderId, s]));

    rosterForDisplay = roster.map((s) => {
      const snap = byRiderId.get(s.riderId);
      if (!snap) return s;
      return {
        ...s,
        rider: {
          ...s.rider,
          age: snap.age,
          potential: snap.potential,
          moyenne: snap.moyenne,
          statPl: snap.statPl,
          statMo: snap.statMo,
          statVal: snap.statVal,
          statClm: snap.statClm,
          statPrl: snap.statPrl,
          statPav: snap.statPav,
          statSp: snap.statSp,
          statAcc: snap.statAcc,
          statDes: snap.statDes,
          statBar: snap.statBar,
          statEnd: snap.statEnd,
          statRes: snap.statRes,
          statRec: snap.statRec,
        },
      };
    });
  }

  return { team, roster: rosterForDisplay, allStints: team.stints };
}

/**
 * Draft info for `season` — a draft is named after the season whose final
 * standings set the pick order (worst team first, reverse of that season's
 * team standings; teams can pick more than once). Its picks join the league
 * in `season + 1`, and the riders they replace stop appearing on the roster
 * from `season + 1` onward.
 */
export async function getDraftBoard(season: number) {
  const joinSeason = season + 1;
  const [standings, picks, pool, retirees] = await Promise.all([
    getTeamRankings(season),
    prisma.rider.findMany({
      where: { draftSeason: season, draftPick: { not: null } },
      orderBy: { draftPick: "asc" },
      include: {
        // Prefer the drafting team when a rider was immediately transferred (closed stint first).
        stints: { where: { startSeason: joinSeason }, include: { team: true }, orderBy: { endSeason: { sort: "asc", nulls: "last" } } },
      },
    }),
    // Prospects eligible for this draft but not yet picked by any team.
    prisma.rider.findMany({
      where: { draftSeason: season, draftPick: null },
      orderBy: { moyenne: "desc" },
    }),
    prisma.rider.findMany({ where: { retirementSeason: season }, orderBy: { lastName: "asc" } }),
  ]);

  const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });
  const pointsByTeam = new Map(standings.map((r) => [r.team.id, r.points]));
  const standingsOrder = [...teams]
    .sort((a, b) => (pointsByTeam.get(a.id) ?? 0) - (pointsByTeam.get(b.id) ?? 0) || a.name.localeCompare(b.name))
    .map((team, i) => ({ rank: i + 1, team, points: pointsByTeam.get(team.id) ?? 0 }));

  // Picks in the order given (by draftPick number), each tagged with the team that drafted them.
  const picksInOrder = picks.map((r) => ({ rider: r, team: r.stints[0]?.team ?? null }));

  return { standingsOrder, picksInOrder, pool, retirees };
}

/**
 * Points scored each season, broken down by "draft class" — riders already in the
 * DB as of season 1 form class S0 (Rider.draftSeason defaults to 0), and riders
 * picked in the season-N draft form class SN. A class is only shown starting the
 * season it actually joins the league (S0 from season 1, SN from season N+1 —
 * picked at the end of season N), and disappears once every one of its riders
 * has retired.
 */
export async function getPointsByDraftClass() {
  const [results, riders, latestSeason] = await Promise.all([
    prisma.result.findMany({
      select: { points: true, race: { select: { season: true } }, rider: { select: { draftSeason: true } } },
    }),
    prisma.rider.findMany({ where: { unpickedSeason: null }, select: { draftSeason: true, retirementSeason: true } }),
    getLatestSeason(),
  ]);

  const maxClass = riders.reduce((max, r) => Math.max(max, r.draftSeason), 0);
  const seasons = Array.from({ length: latestSeason }, (_, i) => i + 1);
  const classes = Array.from({ length: maxClass + 1 }, (_, i) => i);

  const ranges = classes.map((cls) => {
    const members = riders.filter((r) => r.draftSeason === cls);
    const start = cls === 0 ? 1 : cls + 1;
    const allRetired = members.length > 0 && members.every((r) => r.retirementSeason != null);
    const end = allRetired ? Math.max(...members.map((r) => r.retirementSeason as number)) : null;
    return { start, end };
  });

  const totals = new Map<string, number>();
  for (const r of results) {
    const key = `${r.race.season}-${r.rider.draftSeason}`;
    totals.set(key, (totals.get(key) ?? 0) + r.points);
  }

  const points = seasons.map((season) =>
    classes.map((cls, ci) => {
      const { start, end } = ranges[ci];
      if (season < start || (end != null && season > end)) return null;
      return totals.get(`${season}-${cls}`) ?? 0;
    }),
  );

  return { seasons, classes, points };
}

/** All-time career points ranking — every rider's Result.points summed across every season played. */
export async function getAllTimeRiderRanking() {
  const totals = await prisma.result.groupBy({
    by: ["riderId"],
    _sum: { points: true },
  });

  const riders = await prisma.rider.findMany({
    where: { id: { in: totals.map((t) => t.riderId) } },
    include: { stints: { include: { team: true }, orderBy: { startSeason: "asc" } } },
  });
  const riderById = new Map(riders.map((r) => [r.id, r]));

  return totals
    .map((t) => {
      const rider = riderById.get(t.riderId);
      if (!rider) return null;
      const teams: (typeof rider.stints)[number]["team"][] = [];
      const seen = new Set<string>();
      for (const s of rider.stints) {
        if (!seen.has(s.teamId)) {
          seen.add(s.teamId);
          teams.push(s.team);
        }
      }
      return { rider, points: t._sum.points ?? 0, teams };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.points - a.points);
}

export async function getRaces(season?: number) {
  return prisma.race.findMany({
    where: { resultKind: "race", parentRaceId: null, ...(season ? { season } : {}) },
    include: {
      category: true,
      _count: { select: { results: true, children: true } },
      results: { where: { rank: 1 }, take: 1, include: { rider: true, team: true } },
      // For a Grand Tour: each stage's result count (to tell if it's finished) and
      // each jersey's own winner, alongside the hub's own (the general classification).
      children: {
        where: { resultKind: { in: ["stage", "jersey"] } },
        select: {
          resultKind: true,
          jerseyName: true,
          _count: { select: { results: true } },
          results: { where: { rank: 1 }, take: 1, include: { rider: true, team: true } },
        },
      },
    },
    orderBy: { order: "asc" },
  });
}

/** Whether every race of a season has a result — and, for each Grand Tour, all its
 * stages too — same completeness rule as the "Non-terminé" badge on the calendar. */
export async function isSeasonComplete(season: number): Promise<boolean> {
  const races = await getRaces(season);
  if (races.length === 0) return false;

  return races.every((race) => {
    if (race._count.results === 0) return false;
    if (race.category.kind === "grand-tour") {
      const stagesWithResults = race.children.filter((c) => c.resultKind === "stage" && c._count.results > 0).length;
      if (stagesWithResults < GRAND_TOUR_STAGE_COUNT) return false;
    }
    return true;
  });
}

const CAREER_STAT_KEYS = [
  "statPl", "statMo", "statVal", "statClm", "statPrl", "statPav",
  "statSp", "statAcc", "statDes", "statBar", "statEnd", "statRes", "statRec",
] as const;

/**
 * A random rider for the dashboard's "random rider" card — full career snapshot,
 * not just their current stats: best-ever moyenne and best-ever value per stat
 * across every archived season plus the current one, since a rider's live Rider
 * row only holds their latest values (see RiderSeasonStats in schema.prisma).
 */
export async function getRandomRiderCard() {
  const eligibleCount = await prisma.rider.count({ where: { unpickedSeason: null } });
  if (eligibleCount === 0) return null;

  const [rider, latestSeason] = await Promise.all([
    prisma.rider.findFirst({
      where: { unpickedSeason: null },
      skip: Math.floor(Math.random() * eligibleCount),
      include: {
        stints: { include: { team: true }, orderBy: [{ startSeason: "asc" }, { endSeason: { sort: "asc", nulls: "last" } }] },
        results: { include: { race: { include: { category: true } } } },
        seasonStats: true,
      },
    }),
    getLatestSeason(),
  ]);
  if (!rider) return null;

  const firstSeason = rider.stints[0]?.startSeason ?? null;
  const lastStint = rider.stints[rider.stints.length - 1];
  const lastSeason = lastStint ? (lastStint.endSeason ?? latestSeason) : null;

  const wins = rider.results.filter((r) => r.rank === 1).length;
  const podiums = rider.results.filter((r) => r.rank <= 3).length;
  const top10 = rider.results.filter((r) => r.rank <= 10).length;
  const reputation = await computeReputation(rider.id, rider.results);

  const moyenneCareerBest = Math.max(rider.moyenne ?? -Infinity, ...rider.seasonStats.map((s) => s.moyenne ?? -Infinity));

  const careerBestStats = Object.fromEntries(
    CAREER_STAT_KEYS.map((key) => [key, Math.max(rider[key] ?? -Infinity, ...rider.seasonStats.map((s) => s[key] ?? -Infinity))]),
  ) as Record<(typeof CAREER_STAT_KEYS)[number], number>;

  return {
    rider,
    firstSeason,
    lastSeason,
    stillActive: lastStint ? lastStint.endSeason === null : false,
    palmares: { wins, podiums, top10 },
    reputation,
    moyenneCareerBest: Number.isFinite(moyenneCareerBest) ? moyenneCareerBest : null,
    careerBestStats,
  };
}

/** The winner of the same-named race last season — the "defending champion" for a dashboard preview. */
export async function getDefendingChampion(raceName: string, previousSeason: number) {
  const race = await prisma.race.findFirst({
    where: { name: raceName, season: previousSeason, resultKind: "race", parentRaceId: null },
  });
  if (!race) return null;

  const winner = await prisma.result.findFirst({
    where: { raceId: race.id, rank: 1 },
    include: { rider: true },
  });
  return winner;
}

/** The next race of the season with no result yet — for the "upcoming race" dashboard card. */
export async function getNextRace(season: number) {
  return prisma.race.findFirst({
    where: { resultKind: "race", parentRaceId: null, season, results: { none: {} } },
    include: { category: true },
    orderBy: { order: "asc" },
  });
}

export async function getRaceDetail(id: string) {
  const race = await prisma.race.findUnique({
    where: { id },
    include: {
      category: true,
      // For a stage, the parent's own children (siblings) drive the "étape
      // précédente/suivante" nav and the "général & annexes" links after the last one.
      parent: { include: { children: { orderBy: [{ resultKind: "asc" }, { stageNumber: "asc" }] } } },
      results: { include: { rider: true, team: true }, orderBy: { rank: "asc" } },
      children: {
        include: { _count: { select: { results: true } } },
        orderBy: [{ resultKind: "asc" }, { stageNumber: "asc" }],
      },
    },
  });
  return race;
}
