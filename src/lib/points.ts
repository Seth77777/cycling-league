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
