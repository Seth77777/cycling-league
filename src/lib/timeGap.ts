/**
 * Normalizes a same-time marker to "s.t." (as shown for every other rider on the
 * same time) — accepts the French "m.t." (même temps) as an equivalent of the
 * English "s.t." (same time). Any other value is returned trimmed, unchanged.
 */
export function normalizeTimeGap(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(s\.?t\.?|m\.?t\.?)$/i.test(trimmed)) return "s.t.";
  return trimmed;
}
