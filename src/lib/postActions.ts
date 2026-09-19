"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { parsePcmWorkbook, type PcmSheet } from "@/lib/pcmImport";
import { applyRaceResults } from "@/lib/actions";
import { getRiderRankings, getTeamRankings, fullName } from "@/lib/queries";
import { nationalityToIso } from "@/lib/nationality";
import { pointsForRank } from "@/lib/points";
import { findRankGaps } from "@/lib/rankGaps";
import { normalizeName } from "@/lib/names";

const MEDAL_COLOR: Record<number, string> = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" };
const TOP_CUT = 15;
// Placeholder scale for the sandbox generator, which has no real category to draw from.
const TEST_POINTS_SCALE = [200, 150, 100, 80, 65, 50, 40, 30, 20, 10];

function rankCell(rank: number): string {
  const color = MEDAL_COLOR[rank];
  return color ? `[color=${color}][b]${rank}[/b][/color]` : `${rank}`;
}

function centerCell(content: string): string {
  return `[center]${content}[/center]`;
}

/** flagcdn.com is a free public flag CDN — works today, no dependency on this site being deployed. */
function flagImg(nationality: string | null | undefined): string {
  const iso = nationalityToIso(nationality);
  return iso ? `[img]https://flagcdn.com/20x15/${iso}.png[/img]` : "";
}

/** Jersey/race-logo images live under /public on this app, so they need an absolute URL once the site is deployed. */
function localImg(path: string | null | undefined): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  return path && base ? `[img]${base}${path}[/img] ` : "";
}

function renderTable(header: string[], rows: string[][]): string {
  const headerRow = `[tr]${header.map((h) => `[td][b]${h}[/b][/td]`).join("")}[/tr]`;
  const bodyRows = rows.map((row) => `[tr]${row.map((cell) => `[td]${cell}[/td]`).join("")}[/tr]`).join("\n");
  return `[table]\n${headerRow}\n${bodyRows}\n[/table]`;
}

/**
 * Top-15 table always visible, the rest (if any) in a second table inside a plain
 * `[spoiler]` — no `[spoiler=Title]` (unsupported on this forum) and no line break
 * right after `[spoiler]`/before `[/spoiler]`, which some forums render as a large
 * empty paragraph. Still used for a Grand Tour's own classification sheets (GC/
 * mountain/team...) parsed from the PCM export — those aren't touched by the
 * screenshot-based redesign below.
 */
function foldTableAtTop15(header: string[], rows: string[][]): string {
  if (rows.length <= TOP_CUT) return renderTable(header, rows);
  const head = renderTable(header, rows.slice(0, TOP_CUT));
  const rest = renderTable(header, rows.slice(TOP_CUT));
  return `${head}\n[spoiler]${rest}[/spoiler]`;
}

/** A table with nothing visible before it — used for this site's own season standings
 * (individual/team), which the admin wants fully collapsed rather than top-15 + spoiler. */
function renderFullSpoiler(header: string[], rows: string[][]): string {
  return `[spoiler]${renderTable(header, rows)}[/spoiler]`;
}

// ── Tagged screenshots ───────────────────────────────────────────────────────────
//
// The admin pastes their own game screenshots as [img] tags (same "Images" field as
// before). Each filename can end with an optional stage number and/or a kind, right
// before the extension — e.g. "...S1T15.png" (stage 1's top 15), "...GEN.png" (GT
// general classification), "...S12.png" (a plain screenshot of stage 12, not a
// classification). A leading "S<season>" prefix some filenames start with isn't
// significant here since matching is anchored to the end of the filename.

interface TaggedImage {
  raw: string;
  url: string;
  stage: number | null;
  kind: "t15" | "gen" | "mo" | "spr" | "u25" | null;
}

const KIND_SUFFIX_RE = /(T15|GEN|MO|SPR|U25)$/i;
const STAGE_SUFFIX_RE = /S(\d{1,2})$/i;

function parseImageTag(url: string): { stage: number | null; kind: TaggedImage["kind"] } {
  const filename = url.split(/[?#]/)[0].split("/").pop() ?? "";
  const base = filename.replace(/\.[a-z0-9]+$/i, "");

  let kind: TaggedImage["kind"] = null;
  let rest = base;
  const kindMatch = rest.match(KIND_SUFFIX_RE);
  if (kindMatch) {
    kind = kindMatch[1].toLowerCase() as TaggedImage["kind"];
    rest = rest.slice(0, rest.length - kindMatch[1].length);
  }

  let stage: number | null = null;
  const stageMatch = rest.match(STAGE_SUFFIX_RE);
  if (stageMatch) stage = Number(stageMatch[1]);

  return { stage, kind };
}

function extractTaggedImages(imagesRaw: string): TaggedImage[] {
  const tags = imagesRaw.match(/\[img\][\s\S]*?\[\/img\]/gi) ?? [];
  return tags.map((raw) => {
    const url = raw.replace(/\[img\]|\[\/img\]/gi, "").trim();
    const { stage, kind } = parseImageTag(url);
    return { raw, url, stage, kind };
  });
}

/** Embeds the screenshot plus a plain link underneath, so it's still viewable full-size
 * even where the forum doesn't render [img] inline for a given viewer. */
function imageWithLink(img: TaggedImage): string {
  return `${img.raw}\n[url=${img.url}]Voir en grand[/url]`;
}

interface RawResultRow {
  rank: number;
  name: string; // already includes the flag [img] tag
  team: string;
  time: string | null;
}

/** Ranks beyond 15, as plain text inside a [spoiler] — no table, no images, just
 * "rank. name — team — time" one per line. */
function renderPlainRows(rows: RawResultRow[]): string {
  if (rows.length === 0) return "";
  const lines = rows.map((r) => `${r.rank}. ${r.name} — ${r.team} — ${r.time ?? "—"}`);
  return `[spoiler]${lines.join("\n")}[/spoiler]`;
}

/**
 * The results block for one race/stage: a manually-pasted top-15 screenshot if one
 * was tagged for it, else the usual BBCode table with jerseys/flags — then ranks 16+
 * always as plain text in a spoiler. An untagged (no kind) screenshot for this same
 * stage, if any, is shown just above as a plain race photo.
 */
function buildResultsBlock(rawRows: RawResultRow[], top15TableRows: string[][], stageImages: TaggedImage[]): string {
  const stageShot = stageImages.find((img) => img.kind === null);
  const t15Shot = stageImages.find((img) => img.kind === "t15");

  const top = t15Shot ? imageWithLink(t15Shot) : renderTable(["#", "Coureur", "Équipe", "Temps"], top15TableRows);
  const rest = renderPlainRows(rawRows.slice(TOP_CUT));

  return [stageShot?.raw, top, rest].filter(Boolean).join("\n");
}

/** Final GT classification screenshots (GEN/MO/SPR/U25), shown together, visible,
 * ahead of any spoiler — the computed per-sheet tables (renderSheet) still render
 * underneath regardless, as supplementary detail. */
function buildClassificationShots(images: TaggedImage[]): string {
  const shots = images.filter((img): img is TaggedImage & { kind: "gen" | "mo" | "spr" | "u25" } =>
    img.kind === "gen" || img.kind === "mo" || img.kind === "spr" || img.kind === "u25",
  );
  if (shots.length === 0) return "";
  return shots.map(imageWithLink).join("\n\n");
}

interface KnownEntry {
  name: string;
  points: number;
}

/** Parses a pasted "known standings" list, one entry per line: "Name 200", "Name — 200 pts", etc. */
function parseKnownStandings(raw: string): Map<string, KnownEntry> {
  const byKey = new Map<string, KnownEntry>();
  for (const rawLine of raw.split("\n")) {
    const tokens = rawLine.trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 2) continue;

    let last = tokens[tokens.length - 1];
    if (/^pts?\.?$/i.test(last) && tokens.length > 2) {
      tokens.pop();
      last = tokens[tokens.length - 1];
    }
    const points = Number(last.replace(/pts?\.?$/i, ""));
    if (!Number.isFinite(points)) continue;
    tokens.pop();
    while (tokens.length && /^[—-]$/.test(tokens[tokens.length - 1])) tokens.pop();

    const name = tokens.join(" ").trim();
    if (!name) continue;
    const key = normalizeName(name);
    const existing = byKey.get(key);
    byKey.set(key, { name: existing?.name ?? name, points: (existing?.points ?? 0) + points });
  }
  return byKey;
}

/** Adds this race's points on top of any already-known total for the same name (by lowercased key). */
function mergeKnownStandings(known: Map<string, KnownEntry>, additions: { name: string; points: number }[]): KnownEntry[] {
  const merged = new Map(known);
  for (const a of additions) {
    const key = normalizeName(a.name);
    const existing = merged.get(key);
    merged.set(key, { name: existing?.name ?? a.name, points: (existing?.points ?? 0) + a.points });
  }
  return [...merged.values()].sort((a, b) => b.points - a.points);
}

interface Section {
  title: string;
  table: string;
}

function assembleFinalPost(leadingImages: string[], stageSections: string[], classificationShots: string, extraSections: Section[]): string {
  const sections = [
    leadingImages.join("\n"),
    ...stageSections,
    classificationShots,
    ...extraSections.map((s) => `[b]${s.title}[/b]\n${s.table}`),
  ].filter(Boolean);

  return sections.join("\n\n");
}

async function buildRiderIndex() {
  const riders = await prisma.rider.findMany({
    where: { unpickedSeason: null },
    include: { stints: { where: { endSeason: null }, include: { team: true } } },
  });
  return new Map(riders.map((r) => [normalizeName(`${r.firstName} ${r.lastName}`), r]));
}

async function buildTeamIndex() {
  const teams = await prisma.team.findMany();
  return new Map(teams.map((t) => [normalizeName(t.name), t]));
}

/** Renders a secondary classification sheet (GC, points, mountain, team...) read-only — no DB writes. */
function renderSheet(
  sheet: PcmSheet,
  riderIndex: Awaited<ReturnType<typeof buildRiderIndex>>,
  teamIndex: Awaited<ReturnType<typeof buildTeamIndex>>,
): Section {
  if (sheet.kind === "team") {
    const rows = sheet.rows.map((r) => {
      const team = teamIndex.get(normalizeName(r.label));
      return [rankCell(r.rank), centerCell(`${localImg(team?.jerseyUrl)}${r.label}`.trim()), r.time ?? "—"];
    });
    return { title: sheet.name, table: foldTableAtTop15(["#", "Équipe", "Temps"], rows) };
  }

  const rows = sheet.rows.map((r) => {
    const rider = riderIndex.get(normalizeName(r.label));
    const nameCell = `${rider ? flagImg(rider.nationality) : ""} ${r.label}`.trim();
    const team = rider?.stints[0]?.team;
    const teamName = r.team || team?.name || "—";
    return [rankCell(r.rank), nameCell, centerCell(`${localImg(team?.jerseyUrl)}${teamName}`.trim()), r.time ?? "—"];
  });
  return { title: sheet.name, table: foldTableAtTop15(["#", "Coureur", "Équipe", "Temps"], rows) };
}

export type PostState = { post: string; imported: number; skipped: number; gaps: number[] } | { error: string } | null;

/**
 * One post can cover several stages at once (the admin posts a Grand Tour in blocks
 * of a few stages, not one post per stage) — `raceId`/`pcmExport` are repeated form
 * fields, one pair per stage, processed in the order submitted. A single race/stage
 * is just the one-pair case.
 */
export async function generateRacePost(_prevState: PostState, formData: FormData): Promise<PostState> {
  await requireAdmin();

  const raceIds = formData.getAll("raceId").map(String).filter(Boolean);
  const pcmExports = formData.getAll("pcmExport").map(String);
  const imagesRaw = String(formData.get("images") ?? "").trim();
  if (raceIds.length === 0 || raceIds.length !== pcmExports.length) {
    return { error: "Au moins une étape avec son export PCM est requise." };
  }

  const images = extractTaggedImages(imagesRaw);
  const leadingImages = images.filter((img) => img.stage === null && img.kind === null).map((img) => img.raw);

  let totalImported = 0;
  let totalSkipped = 0;
  const allGaps: number[] = [];
  const stageSections: string[] = [];
  let lastExtraSheets: PcmSheet[] = [];
  let season = 0;

  for (let i = 0; i < raceIds.length; i++) {
    const raceId = raceIds[i];
    const xml = pcmExports[i].trim();
    if (!xml) return { error: `Étape ${i + 1} : export PCM requis.` };

    const race = await prisma.race.findUniqueOrThrow({ where: { id: raceId }, include: { category: true } });
    season = race.season;

    const sheets = parsePcmWorkbook(xml);
    if (sheets.length === 0) return { error: `Étape ${i + 1} : aucune ligne de résultat reconnue dans l'export collé.` };
    const [primary, ...extraSheets] = sheets;
    lastExtraSheets = extraSheets;

    const entries = primary.rows.map((r) => ({ rank: r.rank, name: r.label, time: r.time }));
    let imported: number, skipped: number, results: Awaited<ReturnType<typeof applyRaceResults>>["results"], gaps: number[];
    try {
      ({ imported, skipped, results, gaps } = await applyRaceResults(race, entries));
    } catch (e) {
      return { error: e instanceof Error ? e.message : `Échec de l'import (étape ${i + 1}).` };
    }
    totalImported += imported;
    totalSkipped += skipped;
    allGaps.push(...gaps);

    revalidatePath(`/races/${raceId}`);
    if (race.parentRaceId) revalidatePath(`/races/${race.parentRaceId}`);

    const rawRows: RawResultRow[] = results.map((r) => ({
      rank: r.rank,
      name: `${flagImg(r.rider.nationality)} ${fullName(r.rider)}`.trim(),
      team: r.team?.name ?? "Agent libre",
      time: r.time,
    }));
    const top15TableRows = results.slice(0, TOP_CUT).map((r) => [
      rankCell(r.rank),
      `${flagImg(r.rider.nationality)} ${fullName(r.rider)}`.trim(),
      centerCell(`${localImg(r.team?.jerseyUrl)}${r.team?.name ?? "Agent libre"}`.trim()),
      r.time ?? "—",
    ]);

    const stageImages = images.filter((img) => race.stageNumber != null && img.stage === race.stageNumber);
    const resultsBlock = buildResultsBlock(rawRows, top15TableRows, stageImages);
    stageSections.push(`${localImg(race.logoUrl)}[b][size=150]${race.name}[/size][/b]\n${resultsBlock}`);
  }

  revalidatePath("/rankings");

  const classificationShots = buildClassificationShots(images);

  let extraSections: Section[] = [];
  if (lastExtraSheets.length > 0) {
    // Grand Tour stage(s) — the export itself carries the intermediate classifications
    // (general, points, mountain, team...): render each as its own table, read-only.
    const [riderIndex, teamIndex] = await Promise.all([buildRiderIndex(), buildTeamIndex()]);
    extraSections = lastExtraSheets.map((sheet) => renderSheet(sheet, riderIndex, teamIndex));
  }

  const [riderRankings, teamRankings] = await Promise.all([getRiderRankings(season), getTeamRankings(season)]);
  const indivRows = riderRankings.map((r, i) => [
    rankCell(i + 1),
    `${flagImg(r.rider.nationality)} ${fullName(r.rider)}`.trim(),
    centerCell(`${localImg(r.team?.jerseyUrl)}${r.team?.name ?? "Agent libre"}`.trim()),
    `${r.points} pts`,
  ]);
  const teamRows = teamRankings.map((t, i) => [rankCell(i + 1), centerCell(`${localImg(t.team.jerseyUrl)}${t.team.name}`.trim()), `${t.points} pts`]);

  extraSections.push(
    { title: "Classement général individuel", table: renderFullSpoiler(["#", "Coureur", "Équipe", "Points"], indivRows) },
    { title: "Classement par équipes", table: renderFullSpoiler(["#", "Équipe", "Points"], teamRows) },
  );

  const post = assembleFinalPost(leadingImages, stageSections, classificationShots, extraSections);

  return { post, imported: totalImported, skipped: totalSkipped, gaps: allGaps };
}

/**
 * Sandbox version of `generateRacePost` — same parsing and BBCode formatting, but
 * touches no database: rider/team names come straight from the pasted export, and
 * (for a single-sheet, classic-race export) standings are simulated from that same
 * export instead of real season data. A multi-sheet export (Grand Tour stage) is
 * rendered the same read-only way as the real generator's extra classifications,
 * just without the rider/team DB enrichment (no flags/jerseys — nothing to look up).
 * Single-export only — it exists to preview the rendering rules, not the real
 * multi-stage-block workflow.
 */
export async function generateTestPost(_prevState: PostState, formData: FormData): Promise<PostState> {
  await requireAdmin();

  const raceName = String(formData.get("raceName") ?? "").trim() || "Course de test";
  const xml = String(formData.get("pcmExport") ?? "").trim();
  const imagesRaw = String(formData.get("images") ?? "").trim();
  const knownIndivRaw = String(formData.get("knownIndiv") ?? "").trim();
  const knownTeamRaw = String(formData.get("knownTeam") ?? "").trim();
  if (!xml) return { error: "L'export PCM est requis." };

  const sheets = parsePcmWorkbook(xml);
  if (sheets.length === 0) return { error: "Aucune ligne de résultat reconnue dans l'export collé." };
  const [primary, ...extraSheets] = sheets;

  const images = extractTaggedImages(imagesRaw);
  const leadingImages = images.filter((img) => img.stage === null && img.kind === null).map((img) => img.raw);

  const rawRows: RawResultRow[] = primary.rows.map((r) => ({ rank: r.rank, name: r.label, team: r.team || "Équipe inconnue", time: r.time }));
  const top15TableRows = primary.rows.slice(0, TOP_CUT).map((r) => [rankCell(r.rank), r.label, centerCell(r.team || "Équipe inconnue"), r.time ?? "—"]);
  const stageImages = images.filter((img) => img.stage === null || img.stage === 1);
  const resultsBlock = buildResultsBlock(rawRows, top15TableRows, stageImages);

  const classificationShots = buildClassificationShots(images);

  let extraSections: Section[];
  if (extraSheets.length === 0) {
    const withPoints = primary.rows.map((r) => ({ ...r, points: pointsForRank(TEST_POINTS_SCALE, r.rank) }));

    // Known standings pasted in are added to, not replaced by, this race's own points —
    // same as the real generator, which reads existing DB results before writing this one.
    const teamByName = new Map(withPoints.map((r) => [normalizeName(r.label), r.team || "Équipe inconnue"]));
    const knownIndiv = parseKnownStandings(knownIndivRaw);
    const combinedIndiv = mergeKnownStandings(
      knownIndiv,
      withPoints.map((r) => ({ name: r.label, points: r.points })),
    );
    const indivRows = combinedIndiv.map((e, i) => [
      rankCell(i + 1),
      e.name,
      centerCell(teamByName.get(normalizeName(e.name)) ?? "—"),
      `${e.points} pts`,
    ]);

    const knownTeam = parseKnownStandings(knownTeamRaw);
    const teamPointsThisRace = new Map<string, number>();
    for (const r of withPoints) {
      const key = r.team || "Sans équipe";
      teamPointsThisRace.set(key, (teamPointsThisRace.get(key) ?? 0) + r.points);
    }
    const combinedTeam = mergeKnownStandings(
      knownTeam,
      [...teamPointsThisRace.entries()].map(([name, points]) => ({ name, points })),
    );
    const teamRows = combinedTeam.map((e, i) => [rankCell(i + 1), centerCell(e.name), `${e.points} pts`]);

    extraSections = [
      { title: "Classement général individuel", table: renderFullSpoiler(["#", "Coureur", "Équipe", "Points"], indivRows) },
      { title: "Classement par équipes", table: renderFullSpoiler(["#", "Équipe", "Points"], teamRows) },
    ];
  } else {
    extraSections = extraSheets.map((sheet) => {
      if (sheet.kind === "team") {
        const rows = sheet.rows.map((r) => [rankCell(r.rank), centerCell(r.label), r.time ?? "—"]);
        return { title: sheet.name, table: foldTableAtTop15(["#", "Équipe", "Temps"], rows) };
      }
      const rows = sheet.rows.map((r) => [rankCell(r.rank), r.label, centerCell(r.team || "Équipe inconnue"), r.time ?? "—"]);
      return { title: sheet.name, table: foldTableAtTop15(["#", "Coureur", "Équipe", "Temps"], rows) };
    });
  }

  const post = assembleFinalPost(
    leadingImages,
    [`[b][size=150]${raceName}[/size][/b]\n${resultsBlock}`],
    classificationShots,
    extraSections,
  );
  const gaps = findRankGaps(primary.rows.map((r) => r.rank));

  return { post, imported: primary.rows.length, skipped: 0, gaps };
}
