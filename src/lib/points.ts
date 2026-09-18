export function parsePointsByRank(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

export function pointsForRank(pointsByRank: number[], rank: number): number {
  return pointsByRank[rank - 1] ?? 0;
}

interface CategoryLike {
  kind: string;
  pointsByRank: string | null;
  stagePointsByRank: string | null;
  stageTtMultiplier: number;
  generalPointsByRank: string | null;
  jerseyPointsByRank: string | null;
}

interface RaceLike {
  resultKind: string;
  isTimeTrial: boolean;
}

/** The points scale that applies to a given race (or stage/jersey of a grand tour). */
export function scaleForRace(category: CategoryLike, race: RaceLike): number[] {
  if (race.resultKind === "stage") return parsePointsByRank(category.stagePointsByRank ?? "[]");
  if (race.resultKind === "jersey") return parsePointsByRank(category.jerseyPointsByRank ?? "[]");
  // resultKind === "race": either a simple one-day race, or a grand tour's GC.
  if (category.kind === "grand-tour") return parsePointsByRank(category.generalPointsByRank ?? "[]");
  return parsePointsByRank(category.pointsByRank ?? "[]");
}

/** Points for a given finishing rank in a race, including the time-trial multiplier for stages. */
export function computeResultPoints(category: CategoryLike, race: RaceLike, rank: number): number {
  const base = pointsForRank(scaleForRace(category, race), rank);
  if (race.resultKind === "stage" && race.isTimeTrial) return base * category.stageTtMultiplier;
  return base;
}
