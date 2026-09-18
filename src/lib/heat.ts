/**
 * Fixed-threshold rating bands (not relative to the data) — matches the
 * classic cycling-manager attribute grading: each band is a flat color range.
 */
const BANDS: { max: number; bg: string }[] = [
  { max: 59, bg: "#d6d8db" }, // 50-59 — grey ("black")
  { max: 64, bg: "#bcdcf2" }, // 60-64 — light blue
  { max: 69, bg: "#c3e8b8" }, // 65-69 — light green
  { max: 71, bg: "#f2e6a3" }, // 70-71 — light gold
  { max: 74, bg: "#f5c98d" }, // 72-74 — light orange
  { max: 79, bg: "#f0a99e" }, // 75-79 — light red
  { max: Infinity, bg: "#c9a06b" }, // 80-82 — brown
];

export function bandColor(value: number | null | undefined): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  const band = BANDS.find((b) => value <= b.max) ?? BANDS[BANDS.length - 1];
  return band.bg;
}
