"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { computeResultPoints } from "@/lib/points";
import { CALENDAR_TEMPLATE, GRAND_TOUR_STAGE_COUNT } from "@/lib/calendarTemplate";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { normalizeTimeGap } from "@/lib/timeGap";
import { findRankGaps } from "@/lib/rankGaps";
import { normalizeName } from "@/lib/names";

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

  // The stint covering the race's own season — not the rider's current team — so
  // importing an old season's results doesn't put riders on their present-day team
  // (or flag season-N retirees as teamless just because they've since left the sport).
  function stintForRaceSeason(rider: Rider) {
    return rider.stints.find((s) => s.startSeason <= race.season && (s.endSeason === null || s.endSeason > race.season)) ?? null;
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

  const results: { rank: number; time: string | null; points: number; rider: Rider; team: Rider["stints"][number]["team"] | null }[] = [];
  for (const [i, { entry, rider }] of matches.entries()) {
    const rank = i + 1; // position among matched riders only, not the raw export rank
    const stint = stintForRaceSeason(rider);
    const teamId = stint?.teamId ?? null;
    const points = computeResultPoints(race.category, race, rank);
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
          },
        });
      }
    }
  }

  revalidatePath("/races");
}
