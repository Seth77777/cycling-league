/**
 * The stint covering a given season — not necessarily the rider's current team — so
 * resolving a past season's roster doesn't put riders on their present-day team (or
 * flag season-N retirees as teamless just because they've since left the sport).
 */
export function stintForSeason<T extends { startSeason: number; endSeason: number | null }>(
  stints: T[],
  season: number,
): T | null {
  return stints.find((s) => s.startSeason <= season && (s.endSeason === null || s.endSeason > season)) ?? null;
}
