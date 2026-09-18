/** Missing rank numbers in the 1..max(rank) sequence — a hole usually means an unmatched rider. */
export function findRankGaps(ranks: number[]): number[] {
  if (ranks.length === 0) return [];
  const present = new Set(ranks);
  const max = Math.max(...ranks);
  const gaps: number[] = [];
  for (let r = 1; r <= max; r++) if (!present.has(r)) gaps.push(r);
  return gaps;
}
