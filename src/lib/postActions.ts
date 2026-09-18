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
 * empty paragraph.
 */
function foldTableAtTop15(header: string[], rows: string[][]): string {
  if (rows.length <= TOP_CUT) return renderTable(header, rows);
  const head = renderTable(header, rows.slice(0, TOP_CUT));
  const rest = renderTable(header, rows.slice(TOP_CUT));
  return `${head}\n[spoiler]${rest}[/spoiler]`;
}

/** Every `[img]...[/img]` block found in the pasted text, whitespace/case-insensitive. */
function extractImages(imagesRaw: string): string[] {
  return imagesRaw.match(/\[img\][\s\S]*?\[\/img\]/gi) ?? [];
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

function assemblePost(raceName: string, logoUrl: string | null | undefined, images: string[], resultTable: string, extraSections: Section[]): string {
  const logo = localImg(logoUrl); // same "absolute URL once deployed" rule as jersey/logo images
  const sections = [
    images.join("\n"),
    `${logo}[b][size=150]${raceName}[/size][/b]\n${resultTable}`,
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

export async function generateRacePost(_prevState: PostState, formData: FormData): Promise<PostState> {
  await requireAdmin();

  const raceId = String(formData.get("raceId") ?? "");
  const xml = String(formData.get("pcmExport") ?? "").trim();
  const imagesRaw = String(formData.get("images") ?? "").trim();
  if (!raceId || !xml) return { error: "L'export PCM est requis." };

  const race = await prisma.race.findUniqueOrThrow({ where: { id: raceId }, include: { category: true } });

  const sheets = parsePcmWorkbook(xml);
  if (sheets.length === 0) return { error: "Aucune ligne de résultat reconnue dans l'export collé." };
  const [primary, ...extraSheets] = sheets;

  const entries = primary.rows.map((r) => ({ rank: r.rank, name: r.label, time: r.time }));
  let imported: number, skipped: number, results: Awaited<ReturnType<typeof applyRaceResults>>["results"], gaps: number[];
  try {
    ({ imported, skipped, results, gaps } = await applyRaceResults(race, entries));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Échec de l'import." };
  }

  revalidatePath(`/races/${raceId}`);
  if (race.parentRaceId) revalidatePath(`/races/${race.parentRaceId}`);
  revalidatePath("/rankings");

  const images = extractImages(imagesRaw);

  const resultRows = results.map((r) => [
    rankCell(r.rank),
    `${flagImg(r.rider.nationality)} ${fullName(r.rider)}`.trim(),
    centerCell(`${localImg(r.team?.jerseyUrl)}${r.team?.name ?? "Agent libre"}`.trim()),
    r.time ?? "—",
  ]);
  const resultTable = foldTableAtTop15(["#", "Coureur", "Équipe", "Temps"], resultRows);

  let extraSections: Section[];
  if (extraSheets.length === 0) {
    // Single-sheet export (a classic, one-day race) — no intermediate classifications
    // to show, so fall back to this app's own season-cumulative standings.
    const [riderRankings, teamRankings] = await Promise.all([getRiderRankings(race.season), getTeamRankings(race.season)]);

    const indivRows = riderRankings.map((r, i) => [
      rankCell(i + 1),
      `${flagImg(r.rider.nationality)} ${fullName(r.rider)}`.trim(),
      centerCell(`${localImg(r.team?.jerseyUrl)}${r.team?.name ?? "Agent libre"}`.trim()),
      `${r.points} pts`,
    ]);
    const teamRows = teamRankings.map((t, i) => [rankCell(i + 1), centerCell(`${localImg(t.team.jerseyUrl)}${t.team.name}`.trim()), `${t.points} pts`]);

    extraSections = [
      { title: "Classement général individuel", table: foldTableAtTop15(["#", "Coureur", "Équipe", "Points"], indivRows) },
      { title: "Classement par équipes", table: foldTableAtTop15(["#", "Équipe", "Points"], teamRows) },
    ];
  } else {
    // Grand Tour stage — the export itself carries the intermediate classifications
    // (general, points, mountain, team...): render each as its own table, read-only.
    const [riderIndex, teamIndex] = await Promise.all([buildRiderIndex(), buildTeamIndex()]);
    extraSections = extraSheets.map((sheet) => renderSheet(sheet, riderIndex, teamIndex));
  }

  const post = assemblePost(race.name, race.logoUrl, images, resultTable, extraSections);

  return { post, imported, skipped, gaps };
}

/**
 * Sandbox version of `generateRacePost` — same parsing and BBCode formatting, but
 * touches no database: rider/team names come straight from the pasted export, and
 * (for a single-sheet, classic-race export) standings are simulated from that same
 * export instead of real season data. A multi-sheet export (Grand Tour stage) is
 * rendered the same read-only way as the real generator's extra classifications,
 * just without the rider/team DB enrichment (no flags/jerseys — nothing to look up).
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

  const images = extractImages(imagesRaw);

  const resultRows = primary.rows.map((r) => [rankCell(r.rank), r.label, centerCell(r.team || "Équipe inconnue"), r.time ?? "—"]);
  const resultTable = foldTableAtTop15(["#", "Coureur", "Équipe", "Temps"], resultRows);

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
      { title: "Classement général individuel", table: foldTableAtTop15(["#", "Coureur", "Équipe", "Points"], indivRows) },
      { title: "Classement par équipes", table: foldTableAtTop15(["#", "Équipe", "Points"], teamRows) },
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

  const post = assemblePost(raceName, null, images, resultTable, extraSections);
  const gaps = findRankGaps(primary.rows.map((r) => r.rank));

  return { post, imported: primary.rows.length, skipped: 0, gaps };
}
