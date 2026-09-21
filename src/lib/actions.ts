"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { computeResultPoints } from "@/lib/points";
import { CALENDAR_TEMPLATE, GRAND_TOUR_STAGE_COUNT, grandTourStageProfile } from "@/lib/calendarTemplate";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { normalizeTimeGap } from "@/lib/timeGap";
import { findRankGaps } from "@/lib/rankGaps";
import { normalizeName } from "@/lib/names";
import { stintForSeason } from "@/lib/teamHistory";

function str(fd: FormData, key: string): string {
  return (fd.get(key) as string | null)?.trim() ?? "";
}

function csvToJson(raw: string): string {
  const values = raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v));
  return JSON.stringify(values);
}

/** Recognizes a trailing time/gap on a pasted result line: "s.t."/"m.t.", "+ 1'24", "4h15'09"", "+1'24", "+34"" (seconds only, no minutes). */
function extractTimeGap(tokens: string[]): string | null {
  if (tokens.length === 0) return null;
  const last = tokens[tokens.length - 1];

  const normalized = normalizeTimeGap(last);
  if (normalized === "s.t.") return "s.t.";
  if (/^\+?\d+h\d+'\d+"?$/.test(last)) return last;
  if (/^\+\d+'\d*"?$/.test(last)) return last;
  if (/^\+\d+"?$/.test(last)) return last;
  if (tokens.length >= 2 && tokens[tokens.length - 2] === "+" && /^\d+'\d*"?$/.test(last)) {
    return `+ ${last}`;
  }
  if (tokens.length >= 2 && tokens[tokens.length - 2] === "+" && /^\d+"?$/.test(last)) {
    return `+ ${last}`;
  }
  return null;
}

// ── Teams ───────────────────────────────────────────────────────────────────

export async function createTeam(formData: FormData) {
  await requireAdmin();
  const name = str(formData, "name");
  const country = str(formData, "country") || null;
  const manager = str(formData, "manager") || null;
  const color = str(formData, "color") || null;
  const excludeFromRankings = str(formData, "excludeFromRankings") === "on";
  if (!name) throw new Error("Team name is required");

  const team = await prisma.team.create({ data: { name, country, manager, color, excludeFromRankings } });
  revalidatePath("/teams");
  redirect(`/teams/${team.id}`);
}

export async function updateTeam(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const name = str(formData, "name");
  const country = str(formData, "country") || null;
  const manager = str(formData, "manager") || null;
  const color = str(formData, "color") || null;
  if (!id || !name) throw new Error("Team id and name are required");

  await prisma.team.update({ where: { id }, data: { name, country, manager, color } });
  revalidatePath("/teams");
  revalidatePath(`/teams/${id}`);
}

// ── Categories (custom points scales) ──────────────────────────────────────

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const name = str(formData, "name");
  const kind = str(formData, "kind") === "grand-tour" ? "grand-tour" : "simple";

  if (!name) throw new Error("Name is required");

  if (kind === "simple") {
    const pointsRaw = str(formData, "points");
    if (!pointsRaw) throw new Error("Points scale is required");
    await prisma.category.create({
      data: { name, kind, pointsByRank: csvToJson(pointsRaw) },
    });
  } else {
    const stagePointsRaw = str(formData, "stagePoints");
    const generalPointsRaw = str(formData, "generalPoints");
    const jerseyPointsRaw = str(formData, "jerseyPoints");
    const stageTtMultiplier = Number(str(formData, "stageTtMultiplier") || "1");
    if (!stagePointsRaw || !generalPointsRaw) throw new Error("Stage and general points scales are required");

    await prisma.category.create({
      data: {
        name,
        kind,
        stagePointsByRank: csvToJson(stagePointsRaw),
        stageTtMultiplier: stageTtMultiplier || 1,
        generalPointsByRank: csvToJson(generalPointsRaw),
        jerseyPointsByRank: jerseyPointsRaw ? csvToJson(jerseyPointsRaw) : null,
      },
    });
  }

  revalidatePath("/rankings");
}

// ── Races ───────────────────────────────────────────────────────────────────

export async function createRace(formData: FormData) {
  await requireAdmin();
  const name = str(formData, "name");
  const country = str(formData, "country") || null;
  const orderRaw = str(formData, "order");
  const season = Number(str(formData, "season"));
  const categoryId = str(formData, "categoryId");
  if (!name || !categoryId || !season) throw new Error("All fields are required");

  const race = await prisma.race.create({
    data: { name, country, order: orderRaw ? Number(orderRaw) : null, season, categoryId },
  });
  revalidatePath("/races");
  redirect(`/races/${race.id}`);
}

export async function createStage(formData: FormData) {
  await requireAdmin();
  const parentRaceId = str(formData, "parentRaceId");
  const number = Number(str(formData, "number"));
  const isTimeTrial = str(formData, "isTimeTrial") === "on";
  if (!parentRaceId || !number) throw new Error("Stage number is required");

  const parent = await prisma.race.findUniqueOrThrow({ where: { id: parentRaceId } });
  await prisma.race.create({
    data: {
      name: `${parent.name} — Étape ${number}${isTimeTrial ? " (CLM)" : ""}`,
      season: parent.season,
      categoryId: parent.categoryId,
      resultKind: "stage",
      parentRaceId,
      stageNumber: number,
      isTimeTrial,
    },
  });

  revalidatePath(`/races/${parentRaceId}`);
}

/** Toggles CLM/CLM par équipes on a stage that's already been created — the season
 * calendar generates all 21 stages up front with neither flag set, so this is the
 * only way to mark one after the fact, before pasting its results. */
export async function updateStage(formData: FormData) {
  await requireAdmin();
  const raceId = str(formData, "raceId");
  if (!raceId) throw new Error("Race id is required");
  const isTimeTrial = str(formData, "isTimeTrial") === "on";
  const isTeamTimeTrial = str(formData, "isTeamTimeTrial") === "on";

  const race = await prisma.race.update({ where: { id: raceId }, data: { isTimeTrial, isTeamTimeTrial } });

  revalidatePath(`/races/${raceId}`);
  if (race.parentRaceId) revalidatePath(`/races/${race.parentRaceId}`);
}

export async function createJersey(formData: FormData) {
  await requireAdmin();
  const parentRaceId = str(formData, "parentRaceId");
  const jerseyName = str(formData, "jerseyName");
  if (!parentRaceId || !jerseyName) throw new Error("Jersey name is required");

  const parent = await prisma.race.findUniqueOrThrow({ where: { id: parentRaceId } });
  await prisma.race.create({
    data: {
      name: `${parent.name} — ${jerseyName}`,
      season: parent.season,
      categoryId: parent.categoryId,
      resultKind: "jersey",
      parentRaceId,
      jerseyName,
    },
  });

  revalidatePath(`/races/${parentRaceId}`);
}

export type RaceForResults = Prisma.RaceGetPayload<{ include: { category: true } }>;

/**
 * Matches each entry against active riders by full name, computes points, and
 * upserts the Result rows. Shared by `bulkAddResults` (free-text paste, where
 * `name` is everything after the rank — name plus whatever team/time tokens
 * trail it) and the forum post generator (parsed PCM export, where `name` is
 * already just the rider's name) so both save results the same way. The name is
 * resolved by trying the longest word-count candidate first (2-5 words) since
 * free-text lines don't mark where the name ends.
 *
 * Entries whose rider can't be matched are skipped and counted — this is also
 * how PCM's own simulation-only fillers (never drafted, no Rider record) drop
 * out. Their raw export rank is discarded rather than used for scoring: the
 * riders actually in the league are renumbered 1..N in their relative finishing
 * order among themselves, so a filler placing 2nd doesn't push a real rider's
 * result — and their points — down to 3rd.
 *
 * Refuses to import anything if a matched rider has no active team — better to
 * fix the roster first than to silently record them as "Agent libre".
 */
export async function applyRaceResults(race: RaceForResults, entries: { rank: number; name: string; time: string | null }[]) {
  await requireAdmin();
  const riders = await prisma.rider.findMany({
    where: { unpickedSeason: null },
    include: { stints: { include: { team: true } } },
  });
  type Rider = (typeof riders)[number];
  const byName = new Map(riders.map((r) => [normalizeName(`${r.firstName} ${r.lastName}`), r]));

  function stintForRaceSeason(rider: Rider) {
    return stintForSeason(rider.stints, race.season);
  }

  const sortedEntries = [...entries].sort((a, b) => a.rank - b.rank);
  let skipped = 0;
  const matches: { entry: (typeof entries)[number]; rider: Rider }[] = [];

  for (const entry of sortedEntries) {
    const tokens = entry.name.split(/\s+/).filter(Boolean);
    let matched: Rider | null = null;
    for (let len = Math.min(5, tokens.length); len >= 2; len--) {
      const candidate = normalizeName(tokens.slice(0, len).join(" "));
      const hit = byName.get(candidate);
      if (hit) {
        matched = hit;
        break;
      }
    }
    if (!matched) {
      skipped++;
      continue;
    }
    matches.push({ entry, rider: matched });
  }

  const teamless = matches.filter((m) => !stintForRaceSeason(m.rider)?.teamId);
  if (teamless.length > 0) {
    const list = teamless.map((m) => `#${m.entry.rank} ${m.rider.firstName} ${m.rider.lastName}`).join(", ");
    throw new Error(`Coureur(s) sans équipe en saison ${race.season} — mets à jour leur effectif avant d'importer : ${list}`);
  }

  // Team time trial: every rider takes their TEAM's rank (the order distinct teams
  // first appear among the matched riders, since a team's riders finish consecutively
  // in one block) instead of their own sequential position — a real TTT has no
  // meaningful sub-ranking between team-mates, and this is what makes win/podium
  // credit (rank === 1 / rank <= 3) correctly apply to every rider of the winning
  // team, not just whoever happened to be listed first. Points: only the first rider
  // of each team's block actually carries the point value — the rest get 0 — so
  // summing per team for team rankings (getTeamRankings) isn't inflated by roster
  // size, while getRiderRankings excludes these points from individual totals
  // entirely regardless of which row carries them.
  const teamRankByTeamId = new Map<string, number>();
  if (race.isTeamTimeTrial) {
    for (const { rider } of matches) {
      const teamId = stintForRaceSeason(rider)?.teamId;
      if (teamId && !teamRankByTeamId.has(teamId)) teamRankByTeamId.set(teamId, teamRankByTeamId.size + 1);
    }
  }
  const teamAlreadyScored = new Set<string>();

  const results: { rank: number; time: string | null; points: number; rider: Rider; team: Rider["stints"][number]["team"] | null }[] = [];
  for (const [i, { entry, rider }] of matches.entries()) {
    const stint = stintForRaceSeason(rider);
    const teamId = stint?.teamId ?? null;
    const teamRank = teamId ? teamRankByTeamId.get(teamId) : undefined;
    const rank = race.isTeamTimeTrial && teamRank ? teamRank : i + 1; // sequential among matched riders, unless TTT

    let points: number;
    if (race.isTeamTimeTrial && teamId) {
      const isFirstOfTeam = !teamAlreadyScored.has(teamId);
      teamAlreadyScored.add(teamId);
      points = isFirstOfTeam ? computeResultPoints(race.category, race, teamRank!) : 0;
    } else {
      points = computeResultPoints(race.category, race, rank);
    }

    await prisma.result.upsert({
      where: { raceId_riderId: { raceId: race.id, riderId: rider.id } },
      create: { raceId: race.id, riderId: rider.id, teamId, rank, points, time: entry.time },
      update: { rank, points, time: entry.time, teamId },
    });
    results.push({ rank, time: entry.time, points, rider, team: stint?.team ?? null });
  }

  const allRanks = await prisma.result.findMany({ where: { raceId: race.id }, select: { rank: true } });
  const gaps = findRankGaps(allRanks.map((r) => r.rank));

  return { imported: results.length, skipped, results: results.sort((a, b) => a.rank - b.rank), gaps };
}

/**
 * Bulk result entry — paste a whole classement (rank, rider name, team, time/gap
 * per line, any whitespace-separated format). Only rank and rider name are used:
 * the rider's current team is looked up automatically, and time/gap is ignored
 * (not part of the points system). Lines whose rider can't be matched (typos,
 * placeholder/simulated riders, etc.) are skipped and counted, not guessed at.
 */
export async function bulkAddResults(formData: FormData) {
  await requireAdmin();
  const raceId = str(formData, "raceId");
  const text = (formData.get("resultsText") as string | null) ?? "";

  if (!raceId || !text.trim()) throw new Error("La liste des résultats est requise");

  const race = await prisma.race.findUniqueOrThrow({ where: { id: raceId }, include: { category: true } });

  const entries: { rank: number; name: string; time: string | null }[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const tokens = line.split(/\s+/);
    const rank = Number(tokens[0]);
    if (!Number.isInteger(rank) || rank < 1) continue;

    const rest = tokens.slice(1);
    // No recognizable time/gap token at all (just rank + name) — assume same time as
    // the leader rather than making the admin type "s.t." for most of the field.
    const time = extractTimeGap(tokens) ?? "s.t.";
    entries.push({ rank, name: rest.join(" "), time });
  }

  const { imported, skipped, gaps } = await applyRaceResults(race, entries);

  revalidatePath(`/races/${raceId}`);
  if (race.parentRaceId) revalidatePath(`/races/${race.parentRaceId}`);
  revalidatePath("/rankings");

  const gapsParam = gaps.length > 0 ? `&gaps=${gaps.join(",")}` : "";
  redirect(`/races/${raceId}?imported=${imported}&skipped=${skipped}${gapsParam}`);
}

/**
 * Inserts a single rider at a specific rank into an already-existing result set,
 * shifting every rider currently at or below that rank down by one — for fixing a
 * name that got silently skipped during the original paste (a typo, an unusual
 * spelling…) without having to delete everything and re-paste the whole classement.
 * Same "rang nom" line format as one row of the bulk-paste textarea.
 */
export async function insertResult(formData: FormData) {
  await requireAdmin();
  const raceId = str(formData, "raceId");
  const line = ((formData.get("line") as string | null) ?? "").trim();
  if (!raceId || !line) throw new Error("Une ligne 'rang nom' est requise");

  const race = await prisma.race.findUniqueOrThrow({ where: { id: raceId }, include: { category: true } });

  const tokens = line.split(/\s+/).filter(Boolean);
  const rank = Number(tokens[0]);
  if (!Number.isInteger(rank) || rank < 1) throw new Error("Rang invalide");
  const nameTokens = tokens.slice(1);
  if (nameTokens.length === 0) throw new Error("Nom du coureur requis");
  const time = extractTimeGap(tokens) ?? "s.t.";

  const riders = await prisma.rider.findMany({
    where: { unpickedSeason: null },
    include: { stints: { include: { team: true } } },
  });
  const byName = new Map(riders.map((r) => [normalizeName(`${r.firstName} ${r.lastName}`), r]));

  let matched: (typeof riders)[number] | null = null;
  for (let len = Math.min(5, nameTokens.length); len >= 2; len--) {
    const candidate = normalizeName(nameTokens.slice(0, len).join(" "));
    const hit = byName.get(candidate);
    if (hit) {
      matched = hit;
      break;
    }
  }
  if (!matched) throw new Error(`Coureur non reconnu : "${nameTokens.join(" ")}"`);

  const stint = stintForSeason(matched.stints, race.season);
  if (!stint?.teamId) {
    throw new Error(
      `${matched.firstName} ${matched.lastName} n'a pas d'équipe en saison ${race.season} — mets à jour son effectif avant d'importer.`,
    );
  }

  // Shift downward from the bottom up so no two rows ever momentarily share a rank.
  const toShift = await prisma.result.findMany({ where: { raceId, rank: { gte: rank } }, orderBy: { rank: "desc" } });
  for (const r of toShift) {
    const newRank = r.rank + 1;
    await prisma.result.update({
      where: { id: r.id },
      data: { rank: newRank, points: computeResultPoints(race.category, race, newRank) },
    });
  }

  await prisma.result.upsert({
    where: { raceId_riderId: { raceId, riderId: matched.id } },
    create: { raceId, riderId: matched.id, teamId: stint.teamId, rank, points: computeResultPoints(race.category, race, rank), time },
    update: { rank, points: computeResultPoints(race.category, race, rank), teamId: stint.teamId, time },
  });

  revalidatePath(`/races/${raceId}`);
  if (race.parentRaceId) revalidatePath(`/races/${race.parentRaceId}`);
  revalidatePath("/rankings");
}

/** Removes a single result — e.g. a stage classification pasted into the wrong race
 * (general/mountain/points/team...) by mistake. Confirmed client-side before this runs. */
export async function deleteResult(formData: FormData) {
  await requireAdmin();
  const resultId = str(formData, "resultId");
  if (!resultId) throw new Error("Result id is required");

  const result = await prisma.result.delete({ where: { id: resultId }, include: { race: true } });

  revalidatePath(`/races/${result.raceId}`);
  if (result.race.parentRaceId) revalidatePath(`/races/${result.race.parentRaceId}`);
  revalidatePath("/rankings");
}

/** Wipes every result for a race in one go — e.g. a whole classification pasted into
 * the wrong race by mistake, rather than removing each row one by one. Confirmed
 * client-side before this runs. */
export async function deleteAllResults(formData: FormData) {
  await requireAdmin();
  const raceId = str(formData, "raceId");
  if (!raceId) throw new Error("Race id is required");

  const race = await prisma.race.findUniqueOrThrow({ where: { id: raceId } });
  await prisma.result.deleteMany({ where: { raceId } });

  revalidatePath(`/races/${raceId}`);
  if (race.parentRaceId) revalidatePath(`/races/${race.parentRaceId}`);
  revalidatePath("/rankings");
}

/**
 * Builds the season's full calendar from the fixed annual template — same races,
 * same order, every year. Grand tours are created with all 21 stages pre-generated.
 */
export async function generateSeasonCalendar(formData: FormData) {
  await requireAdmin();
  const season = Number(str(formData, "season"));
  if (!season) throw new Error("Season is required");

  const existing = await prisma.race.count({ where: { season, resultKind: "race", parentRaceId: null } });
  if (existing > 0) throw new Error(`Le calendrier de la saison ${season} existe déjà (${existing} courses).`);

  const [classique, grandTour] = await Promise.all([
    prisma.category.findUniqueOrThrow({ where: { name: "Classique" } }),
    prisma.category.findUniqueOrThrow({ where: { name: "Grand tour" } }),
  ]);

  for (const [i, entry] of CALENDAR_TEMPLATE.entries()) {
    const race = await prisma.race.create({
      data: {
        name: entry.name,
        country: entry.country,
        order: i + 1,
        season,
        categoryId: (entry.grandTour ? grandTour : classique).id,
        logoUrl: entry.logoUrl ?? null,
        profileUrl: entry.profileUrl ?? null,
      },
    });

    if (entry.grandTour) {
      for (let n = 1; n <= GRAND_TOUR_STAGE_COUNT; n++) {
        await prisma.race.create({
          data: {
            name: `${entry.name} — Étape ${n}`,
            country: entry.country,
            season,
            categoryId: grandTour.id,
            resultKind: "stage",
            parentRaceId: race.id,
            stageNumber: n,
            profileUrl: grandTourStageProfile(entry.name, n, season),
          },
        });
      }
    }
  }

  revalidatePath("/races");
}
