/**
 * Parses a "Cycling Manager" results export — Excel 2003 XML (SpreadsheetML). A
 * one-day race export has a single worksheet ("Stage results"). A Grand Tour
 * stage export has several: the stage result plus intermediate classifications
 * (general, points, mountain, team...), each its own worksheet. Column order and
 * even column set differ between them (a team classification sheet has no rider
 * name column, for instance) so columns are located by their header text rather
 * than by fixed position. Regex-based rather than a general XML parser: the
 * export format is fixed, so this avoids a new dependency.
 */
import { normalizeTimeGap } from "@/lib/timeGap";

export interface PcmSheetRow {
  rank: number;
  /** Rider name for a "rider" sheet, team name for a "team" sheet. */
  label: string;
  /** Team name — only populated on "rider" sheets that have their own team column. */
  team: string;
  time: string | null;
}

export interface PcmSheet {
  name: string;
  /** "team" when the sheet has no separate rider-name column (e.g. a team classification). */
  kind: "rider" | "team";
  rows: PcmSheetRow[];
}

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function cellText(cellXml: string): string {
  const cdata = cellXml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) return cdata[1].trim();
  const data = cellXml.match(/<Data[^>]*>([\s\S]*?)<\/Data>/);
  return data ? decodeXmlEntities(data[1]).trim() : "";
}

function findHeaderIndex(header: string[], ...names: string[]): number {
  for (const name of names) {
    const i = header.indexOf(name);
    if (i !== -1) return i;
  }
  return -1;
}

export function parsePcmWorkbook(xml: string): PcmSheet[] {
  const sheets: PcmSheet[] = [];

  for (const wsMatch of xml.matchAll(/<Worksheet[^>]*ss:Name="([^"]*)"[^>]*>([\s\S]*?)<\/Worksheet>/g)) {
    const sheetName = decodeXmlEntities(wsMatch[1]);
    const allRows = [...wsMatch[2].matchAll(/<Row[^>]*>([\s\S]*?)<\/Row>/g)].map((m) =>
      [...m[1].matchAll(/<Cell[^>]*>([\s\S]*?)<\/Cell>/g)].map((c) => cellText(c[1]))
    );
    if (allRows.length < 2) continue; // needs at least a header + one data row

    const header = allRows[0].map((h) => h.trim().toLowerCase());
    const rankIdx = findHeaderIndex(header, "rank", "rang");
    const nameIdx = findHeaderIndex(header, "name", "nom");
    const teamIdx = findHeaderIndex(header, "team", "équipe", "equipe");
    const timeIdx = findHeaderIndex(header, "time", "temps");
    if (rankIdx === -1) continue; // not a classification sheet we understand

    // No rider-name column but a team-like column: the "team" column IS the row's identity.
    const kind: PcmSheet["kind"] = nameIdx === -1 && teamIdx !== -1 ? "team" : "rider";
    const labelIdx = nameIdx !== -1 ? nameIdx : teamIdx;
    if (labelIdx === -1) continue;

    const rows: PcmSheetRow[] = [];
    for (const cells of allRows.slice(1)) {
      const rank = Number(cells[rankIdx]);
      const label = cells[labelIdx];
      if (!Number.isInteger(rank) || rank < 1 || !label) continue;

      rows.push({
        rank,
        label,
        team: kind === "rider" && teamIdx !== -1 ? cells[teamIdx] ?? "" : "",
        time: timeIdx !== -1 ? normalizeTimeGap(cells[timeIdx]) : null,
      });
    }
    if (rows.length > 0) sheets.push({ name: sheetName, kind, rows });
  }

  return sheets;
}
