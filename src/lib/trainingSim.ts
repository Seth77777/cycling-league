// Training evolution projection — the computation half of a ported "cycling-training-calc"
// tool. The fixed scale itself (BAREME, training defs, stat caps) lives in ./trainingBareme;
// this file adapts a DB rider row into that tool's input shape and ports the year-by-year
// evolution table logic (originally in EvolutionTable.tsx) into a plain function the UI can
// call. Pure functions only — nothing here touches the database or persists anything.

import {
  STAT_KEYS,
  PRINCIPAL_STATS,
  SECONDARY_STATS,
  TRAININGS,
  getPotTier,
  getTrainingGain,
  getStatCap,
  autoSecondaryGrowth,
  getRegressionMagnitude,
  REGRESSION_STAT_COUNT,
  STAT_LABELS,
  type StatKey,
  type TrainingDef,
  type TrainingGain,
} from "./trainingBareme";

export {
  STAT_KEYS,
  STAT_LABELS,
  PRINCIPAL_STATS,
  SECONDARY_STATS,
  TRAININGS,
  POT_TIERS,
  BAREME,
  getPotTier,
  getStatCap,
  getTrainingGain,
  REGRESSION_TABLE,
  FIRST_REGRESSION_AGE,
  getRegressionMagnitude,
  type StatKey,
  type TrainingDef,
  type TrainingGain,
} from "./trainingBareme";

/** Maps a StatKey to the Prisma Rider column that holds its current value. */
export const STAT_FIELDS: Record<StatKey, string> = {
  pl: "statPl", mo: "statMo", val: "statVal", clm: "statClm", prl: "statPrl", pav: "statPav",
  sp: "statSp", acc: "statAcc", des: "statDes", bar: "statBar", end: "statEnd", res: "statRes", rec: "statRec",
};

/** Last age the training barème covers; ages beyond it regress instead (see ./trainingBareme). */
const LAST_TRAINING_AGE = 30;
/** Practical horizon for the multi-year projection — regression itself has no upper bound. */
export const DEFAULT_END_AGE = 40;

const STAT_FLOOR = 50;
const STAT_CEILING = 82;
const POTENTIAL_FLOOR = 1;
const POTENTIAL_CEILING = 8;

// ── DB row adapter ───────────────────────────────────────────────────────────────

export interface SimRider {
  age: number;
  potentiel: number; // 1-8, matches this league's Rider.potential column directly
  stats: Record<StatKey, number>;
}

/** Loose shape covering the Prisma Rider stat columns, so callers can pass a DB row directly. */
export interface RiderStatSource {
  age: number | null;
  potential: number | null;
  statPl: number | null; statMo: number | null; statVal: number | null; statClm: number | null;
  statPrl: number | null; statPav: number | null; statSp: number | null; statAcc: number | null;
  statDes: number | null; statBar: number | null; statEnd: number | null; statRes: number | null; statRec: number | null;
}

/** Returns null when a rider lacks the data (age/potential) required to project. */
export function toSimRider(r: RiderStatSource): SimRider | null {
  if (r.age == null || r.potential == null) return null;
  const stats = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) {
    const field = STAT_FIELDS[k] as keyof RiderStatSource;
    stats[k] = (r[field] as number | null) ?? 0;
  }
  return { age: r.age, potentiel: Math.max(1, Math.min(8, r.potential)), stats };
}

// ── Evolution table (year-by-year, using the fixed barème) ───────────────────────

export interface YearChoice {
  trainingKey: string;
  notePick?: StatKey;
}

export type Plan = Record<number, YearChoice>;

export interface EvolutionRow {
  age: number;
  stats: Record<StatKey, number>;
  trainingKey: string;
  notePoints: number;
  notePick: StatKey | null;
  noteCategory: StatKey[];
  availableTrainings: TrainingDef[];
  cappedStats: StatKey[];
  /** Set instead of a training choice once the rider is past the barème (31+). */
  regression?: { magnitude: number; stats: StatKey[] };
}

/**
 * Builds the year-by-year projection from `rider.age` onward: a chosen training per
 * year (plus automatic secondary growth, age 18-22) through 30, then an automatic
 * regression on the 3 best stats every year from 31 on (see ./trainingBareme). `plan`
 * supplies the training/note choice per age below 31; any age missing from `plan`, or
 * whose stored choice is no longer valid, falls back to the first available training
 * that year. A final frozen row (`endAge + 1`) is appended.
 *
 * `endAge` defaults to a practical horizon past the last age the barème covers (30);
 * pass `rider.age` to project a single season only.
 */
export function computeEvolution(rider: SimRider, plan: Plan, endAge: number = DEFAULT_END_AGE): EvolutionRow[] {
  const potTier = getPotTier(rider.potentiel);
  const result: EvolutionRow[] = [];
  let stats = { ...rider.stats };

  const addDelta = (target: Record<StatKey, number>, k: StatKey, v: number) => {
    target[k] = Math.min(getStatCap(k, potTier), (target[k] ?? 0) + v);
  };

  for (let age = rider.age; age <= endAge; age++) {
    if (age > LAST_TRAINING_AGE) {
      const magnitude = getRegressionMagnitude(age, potTier.key) ?? 0;
      const hitStats = [...STAT_KEYS]
        .sort((a, b) => stats[b] - stats[a] || STAT_KEYS.indexOf(a) - STAT_KEYS.indexOf(b))
        .slice(0, REGRESSION_STAT_COUNT);

      result.push({
        age, stats: { ...stats }, trainingKey: "regression", notePoints: 0, notePick: null, noteCategory: [],
        availableTrainings: [], cappedStats: [],
        regression: magnitude > 0 ? { magnitude, stats: hitStats } : undefined,
      });

      if (magnitude > 0) {
        const next = { ...stats };
        for (const k of hitStats) next[k] = Math.max(STAT_FLOOR, next[k] - magnitude);
        stats = next;
      }
      continue;
    }

    const availableTrainings = TRAININGS.filter((t) => getTrainingGain(age, potTier.key, t.key));
    const stored = plan[age];
    const trainingKey = stored?.trainingKey && availableTrainings.some((t) => t.key === stored.trainingKey)
      ? stored.trainingKey
      : (availableTrainings[0]?.key ?? "");
    const gain = getTrainingGain(age, potTier.key, trainingKey);

    let notePoints = 0;
    let notePick: StatKey | null = null;
    let noteCategory: StatKey[] = [];
    if (gain?.type === "note") {
      notePoints = gain.points;
      const cat = gain.category === "principale" ? PRINCIPAL_STATS : SECONDARY_STATS;
      noteCategory = cat.filter((k) => stats[k] < getStatCap(k, potTier));
      const storedPick = stored?.trainingKey === trainingKey ? stored.notePick : undefined;
      notePick = storedPick && noteCategory.includes(storedPick) ? storedPick : (noteCategory[0] ?? null);
    }

    // Stats whose gain this year would exceed the cap ("wasted" training).
    const growth = autoSecondaryGrowth(age);
    const intended: Partial<Record<StatKey, number>> = {};
    const addIntended = (k: StatKey, v: number) => { intended[k] = (intended[k] ?? 0) + v; };
    for (const [k, v] of Object.entries(growth)) addIntended(k as StatKey, v ?? 0);
    if (gain?.type === "fixed") {
      for (const [k, v] of Object.entries(gain.deltas)) addIntended(k as StatKey, v ?? 0);
    } else if (gain?.type === "note" && gain.extra) {
      for (const [k, v] of Object.entries(gain.extra)) addIntended(k as StatKey, v ?? 0);
    }
    const cappedStats: StatKey[] = [];
    for (const [k, v] of Object.entries(intended)) {
      const key = k as StatKey;
      const delta = v ?? 0;
      if (delta > 0 && stats[key] + delta > getStatCap(key, potTier)) cappedStats.push(key);
    }

    result.push({ age, stats: { ...stats }, trainingKey, notePoints, notePick, noteCategory, availableTrainings, cappedStats });

    const next = { ...stats };
    for (const [k, v] of Object.entries(growth)) addDelta(next, k as StatKey, v ?? 0);
    if (gain?.type === "fixed") {
      for (const [k, v] of Object.entries(gain.deltas)) addDelta(next, k as StatKey, v ?? 0);
    } else if (gain?.type === "note") {
      if (gain.extra) {
        for (const [k, v] of Object.entries(gain.extra)) addDelta(next, k as StatKey, v ?? 0);
      }
      if (notePick) addDelta(next, notePick, notePoints);
    }
    stats = next;
  }

  result.push({
    age: Math.max(rider.age, endAge + 1),
    stats,
    trainingKey: "",
    notePoints: 0,
    notePick: null,
    noteCategory: [],
    availableTrainings: [],
    cappedStats: [],
  });

  return result;
}

// ── Lucky/unlucky roll ("Entraîner" button) ───────────────────────────────────────
//
// A one-off random pass applied on top of an already-computed season result — never
// persisted, purely a preview. Per stat, independently, one roll picks a swing from
// a fixed distribution (90% no swing); the result is clamped to [50, 82], which can
// push a stat beyond the rider's normal POT-tier cap. Potential (1-8) gets its own,
// smaller-magnitude roll, clamped to [1, 8].

interface LuckTier { delta: number; chance: number }

/** +3 0.5% · +2 1.5% · +1 3% · -1 3% · -2 1.5% · -3 0.5% · else no swing. */
const STAT_LUCK_TIERS: LuckTier[] = [
  { delta: 3, chance: 0.005 },
  { delta: 2, chance: 0.015 },
  { delta: 1, chance: 0.03 },
  { delta: -1, chance: 0.03 },
  { delta: -2, chance: 0.015 },
  { delta: -3, chance: 0.005 },
];

/** +2 0.5% · +1 1.5% · -1 1.5% · -2 0.5% · else no swing. */
const POTENTIAL_LUCK_TIERS: LuckTier[] = [
  { delta: 2, chance: 0.005 },
  { delta: 1, chance: 0.015 },
  { delta: -1, chance: 0.015 },
  { delta: -2, chance: 0.005 },
];

function rollDelta(tiers: LuckTier[], rng: () => number): number {
  const r = rng();
  let cumulative = 0;
  for (const tier of tiers) {
    cumulative += tier.chance;
    if (r < cumulative) return tier.delta;
  }
  return 0;
}

export interface LuckResult {
  finalStats: Record<StatKey, number>;
  /** Only stats where luck actually moved the value (after clamping), signed by direction and magnitude. */
  luckStats: Partial<Record<StatKey, number>>;
  potentiel: number;
  potentielDelta: number;
}

export function applyLuck(
  baseStats: Record<StatKey, number>,
  potentiel: number,
  rng: () => number = Math.random,
): LuckResult {
  const finalStats = { ...baseStats };
  const luckStats: Partial<Record<StatKey, number>> = {};

  for (const k of STAT_KEYS) {
    const base = baseStats[k];
    const roll = rollDelta(STAT_LUCK_TIERS, rng);
    if (roll === 0) continue;
    const final = Math.max(STAT_FLOOR, Math.min(STAT_CEILING, base + roll));
    if (final !== base) {
      finalStats[k] = final;
      luckStats[k] = final - base;
    }
  }

  const potRoll = rollDelta(POTENTIAL_LUCK_TIERS, rng);
  const newPotentiel = Math.max(POTENTIAL_FLOOR, Math.min(POTENTIAL_CEILING, potentiel + potRoll));

  return {
    finalStats,
    luckStats,
    potentiel: newPotentiel,
    potentielDelta: newPotentiel - potentiel,
  };
}

// ── Formatting helpers (barème reference page) ────────────────────────────────────

/** Human-readable summary of a training's gain, e.g. "MO+2, DES+1" or "Note secondaire +3". */
export function formatTrainingGain(gain: TrainingGain | undefined): string {
  if (!gain) return "—";
  if (gain.type === "fixed") {
    return Object.entries(gain.deltas)
      .map(([k, v]) => `${STAT_LABELS[k as StatKey]}+${v}`)
      .join(", ");
  }
  const extra = gain.extra
    ? " + " + Object.entries(gain.extra).map(([k, v]) => `${STAT_LABELS[k as StatKey]}+${v}`).join(", ")
    : "";
  return `Note ${gain.category} +${gain.points}${extra}`;
}
