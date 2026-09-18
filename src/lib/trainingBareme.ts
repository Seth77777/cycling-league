// Fixed training scale — ported verbatim from a companion "cycling-training-calc" tool.
// Data covers riders age 18-30, POT 1-8. Do not hand-edit the BAREME table below;
// regenerate it from the source tool if the scale itself changes.

export const STAT_KEYS = [
  'pl', 'mo', 'val', 'clm', 'prl', 'pav',
  'sp', 'acc', 'des', 'bar', 'end', 'res', 'rec',
] as const;

export type StatKey = typeof STAT_KEYS[number];

export const STAT_LABELS: Record<StatKey, string> = {
  pl: 'PL', mo: 'MO', val: 'VAL', clm: 'CLM', prl: 'PRL', pav: 'PAV',
  sp: 'SP', acc: 'ACC', des: 'DES', bar: 'BAR', end: 'END', res: 'RES', rec: 'REC',
};

/** Stats principales (cibles directes des entraînements de discipline) */
export const PRINCIPAL_STATS: StatKey[] = ['mo', 'val', 'clm', 'pav', 'sp'];

/** Stats secondaires (cibles des "Notes Secondaires" et entraînements complémentaires) */
export const SECONDARY_STATS: StatKey[] = ['pl', 'prl', 'acc', 'des', 'bar', 'end', 'res', 'rec'];

// ── Types d'entraînement ────────────────────────────────────────────────────────

export interface TrainingDef {
  key:   string;
  label: string;
}

/** Placeholder "no training chosen yet" option — 0 evolution, always available, and the
 * default for any age the user hasn't touched. Keeps a blank projection blank instead of
 * silently picking a real training for people who haven't decided anything yet. */
export const NONE_TRAINING: TrainingDef = { key: "none", label: "---" };

export const TRAININGS: TrainingDef[] = [
  { key: 'grimpeur',       label: 'Grimpeur' },
  { key: 'puncheur',       label: 'Puncheur' },
  { key: 'sprinteur',      label: 'Sprinteur' },
  { key: 'rouleur',        label: 'Rouleur' },
  { key: 'pave',           label: 'Pavé' },
  { key: 'complet_bosses', label: 'Complet Bosses' },
  { key: 'complet_plat',   label: 'Complet Plat' },
  { key: 'secondaire',     label: 'Secondaire' },
  { key: 'point_faible',   label: 'Point faible (note ≤ 68)' },
  { key: 'perfection',     label: 'Perfection (note ≥ 69)' },
];

// ── Gains d'un entraînement ──────────────────────────────────────────────────────
//
// Soit des gains fixes sur des stats précises, soit des Notes à répartir
// librement par l'utilisateur sur les stats principales/secondaires (avec
// éventuellement quelques gains fixes garantis en plus).

export interface FixedGain {
  type:   'fixed';
  deltas: Partial<Record<StatKey, number>>;
}

export interface NoteGain {
  type:     'note';
  category: 'principale' | 'secondaire';
  points:   number;
  /** Gains fixes garantis en plus des points à répartir librement */
  extra?:   Partial<Record<StatKey, number>>;
}

export type TrainingGain = FixedGain | NoteGain;

// ── Paliers de potentiel (POT 1 à POT 8) ─────────────────────────────────────────
//
// "Max" = plafond des stats principales pour ce palier (POT1 = 75 ... POT8 = 82).
// Les stats secondaires peuvent toujours monter jusqu'à 82, quel que soit le palier.

export interface PotTier {
  key:   string;
  label: string;
  max:   number;
}

export const POT_TIERS: PotTier[] = Array.from({ length: 8 }, (_, i) => ({
  key:   `pot${i + 1}`,
  label: `POT ${i + 1}`,
  max:   75 + i,
}));

/** Renvoie le palier correspondant au niveau de potentiel (1 à 8) d'un coureur. */
export function getPotTier(potentiel: number): PotTier {
  return POT_TIERS[potentiel - 1] ?? POT_TIERS[0];
}

/** Plafond absolu des statistiques secondaires, indépendant du potentiel. */
export const SECONDARY_CAP = 82;

/** Plafond d'une statistique pour un coureur donné. */
export function getStatCap(stat: StatKey, potTier: PotTier): number {
  return (PRINCIPAL_STATS as readonly StatKey[]).includes(stat) ? potTier.max : SECONDARY_CAP;
}

// ── Croissance naturelle ─────────────────────────────────────────────────────────
//
// Les coureurs de 18 à 22 ans (inclus) gagnent +1 dans toutes les stats
// secondaires en fin d'année, avant application de l'entraînement.

export function autoSecondaryGrowth(age: number): Partial<Record<StatKey, number>> {
  if (age < 18 || age > 22) return {};
  return SECONDARY_STATS.reduce((acc, k) => {
    acc[k] = 1;
    return acc;
  }, {} as Partial<Record<StatKey, number>>);
}

// ── Barème : bareme[age][potTierKey][trainingKey] ────────────────────────────────
//
// Données couvrant les coureurs de 18 à 30 ans, POT 1 à 8.

export const BAREME: Record<number, Record<string, Record<string, TrainingGain>>> = {
  18: {
    pot1: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, des: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 2, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 2, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 2, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3 },
      perfection: { type: 'note', category: 'secondaire', points: 1 },
    },
    pot2: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 2, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 2, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, bar: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 1 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot3: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 1, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 1, bar: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot4: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 2 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 2, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 2, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 2, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, end: 1, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 2, bar: 1, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
    pot5: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 2, rec: 1 } },
      puncheur: { type: 'fixed', deltas: { mo: 1, val: 2, acc: 2, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 2, end: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 2, end: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pl: 1, pav: 2, bar: 1, end: 1, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 2, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 2, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 2, bar: 2, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
    },
    pot6: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 2, des: 1, res: 2, rec: 1 } },
      puncheur: { type: 'fixed', deltas: { mo: 1, val: 2, acc: 2, bar: 1, res: 2 } },
      sprinteur: { type: 'fixed', deltas: { pl: 2, sp: 2, acc: 2, end: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 2, clm: 2, prl: 2, end: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pl: 1, pav: 2, bar: 1, end: 2, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 2, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 2, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 2, acc: 3, bar: 2, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 4 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
    },
    pot7: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 2, des: 1, res: 2, rec: 2 } },
      puncheur: { type: 'fixed', deltas: { mo: 2, val: 2, acc: 2, bar: 1, res: 2 } },
      sprinteur: { type: 'fixed', deltas: { pl: 2, sp: 2, acc: 2, end: 2, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 2, clm: 2, prl: 2, end: 2, rec: 1 } },
      pave: { type: 'fixed', deltas: { pl: 2, pav: 2, bar: 1, end: 2, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 2, val: 2, pav: 2, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 1, pav: 2, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 2, acc: 3, bar: 2, end: 3, res: 3 } },
      point_faible: { type: 'note', category: 'secondaire', points: 5, extra: { bar: 5 } },
      perfection: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 3 } },
    },
    pot8: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 2, acc: 1, des: 1, res: 2, rec: 2 } },
      puncheur: { type: 'fixed', deltas: { mo: 2, val: 2, sp: 1, acc: 2, bar: 1, res: 2 } },
      sprinteur: { type: 'fixed', deltas: { pl: 2, sp: 2, acc: 2, end: 2, res: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 2, clm: 2, prl: 2, end: 2, res: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pl: 2, val: 1, pav: 2, bar: 1, end: 2, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 2, val: 2, pav: 2, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 1, pav: 2, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 3, acc: 3, bar: 3, end: 3, res: 3 } },
      point_faible: { type: 'note', category: 'secondaire', points: 6, extra: { bar: 5 } },
      perfection: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 4 } },
    },
  },
  19: {
    pot1: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, des: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3 },
      perfection: { type: 'note', category: 'secondaire', points: 1 },
    },
    pot2: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, bar: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 1 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot3: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, val: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 1, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1, end: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 1, bar: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot4: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 1, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 2, bar: 1, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
    pot5: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 2, rec: 1 } },
      puncheur: { type: 'fixed', deltas: { mo: 1, val: 2, acc: 2, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 2, end: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 2, end: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pl: 1, pav: 2, bar: 1, end: 1, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 2, bar: 2, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
    },
    pot6: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 2, des: 1, res: 2, rec: 1 } },
      puncheur: { type: 'fixed', deltas: { mo: 1, val: 2, acc: 2, bar: 1, res: 2 } },
      sprinteur: { type: 'fixed', deltas: { pl: 2, sp: 2, acc: 2, end: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 2, clm: 2, prl: 2, end: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pl: 1, pav: 2, bar: 1, end: 2, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 2, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 2, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 2, acc: 3, bar: 2, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
    },
    pot7: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 2, des: 1, res: 2, rec: 2 } },
      puncheur: { type: 'fixed', deltas: { mo: 2, val: 2, acc: 2, bar: 1, res: 2 } },
      sprinteur: { type: 'fixed', deltas: { pl: 2, sp: 2, acc: 2, end: 2, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 2, clm: 2, prl: 2, end: 2, rec: 1 } },
      pave: { type: 'fixed', deltas: { pl: 2, pav: 2, bar: 1, end: 2, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 2, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 2, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 2, acc: 3, bar: 2, end: 3, res: 3 } },
      point_faible: { type: 'note', category: 'secondaire', points: 5, extra: { bar: 4 } },
      perfection: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 3 } },
    },
    pot8: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 2, des: 1, res: 2, rec: 2 } },
      puncheur: { type: 'fixed', deltas: { mo: 2, val: 2, acc: 2, bar: 1, res: 2 } },
      sprinteur: { type: 'fixed', deltas: { pl: 2, sp: 2, acc: 2, end: 2, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 2, clm: 2, prl: 2, end: 2, rec: 1 } },
      pave: { type: 'fixed', deltas: { pl: 2, pav: 2, bar: 1, end: 2, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 2, val: 2, pav: 2, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 1, pav: 2, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 2, acc: 3, bar: 3, end: 3, res: 3 } },
      point_faible: { type: 'note', category: 'secondaire', points: 5, extra: { bar: 5 } },
      perfection: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 3 } },
    },
  },
  20: {
    pot1: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, des: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, pav: 1, sp: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3 },
      perfection: { type: 'note', category: 'secondaire', points: 1 },
    },
    pot2: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, bar: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 1 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot3: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, val: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 1, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1, end: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 1, bar: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot4: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 1, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 2, bar: 1, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
    pot5: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 2 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 2, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 2, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 2, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 2, bar: 2, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
    },
    pot6: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 2, des: 1, res: 2 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 2, bar: 1, res: 2 } },
      sprinteur: { type: 'fixed', deltas: { pl: 2, sp: 2, acc: 2, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 2, clm: 2, prl: 2, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 2, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 3, bar: 2, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
    },
    pot7: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 2, des: 1, res: 2, rec: 1 } },
      puncheur: { type: 'fixed', deltas: { mo: 1, val: 2, acc: 2, bar: 1, res: 2 } },
      sprinteur: { type: 'fixed', deltas: { pl: 2, sp: 2, acc: 2, end: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 2, clm: 2, prl: 2, end: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pl: 1, pav: 2, bar: 1, end: 2, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 2, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 2, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 2, acc: 3, bar: 2, end: 3, res: 3 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 4 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
    },
    pot8: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 2, des: 1, res: 2, rec: 1 } },
      puncheur: { type: 'fixed', deltas: { mo: 1, val: 2, acc: 2, bar: 1, res: 2 } },
      sprinteur: { type: 'fixed', deltas: { pl: 2, sp: 2, acc: 2, end: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 2, clm: 2, prl: 2, end: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pl: 1, pav: 2, bar: 1, end: 2, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 2, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 2, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 2, acc: 3, bar: 2, end: 3, res: 3 } },
      point_faible: { type: 'note', category: 'secondaire', points: 5, extra: { bar: 4 } },
      perfection: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 3 } },
    },
  },
  21: {
    pot1: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, des: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1 } },
      complet_plat: { type: 'fixed', deltas: { clm: 1, pav: 1, sp: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3 },
      perfection: { type: 'note', category: 'secondaire', points: 1 },
    },
    pot2: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, pav: 1, sp: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, bar: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 1 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot3: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, val: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 1, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1, end: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, bar: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot4: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 1, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 2, bar: 1, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
    pot5: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 2 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 2, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 2, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 2, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 2, bar: 1, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
    },
    pot6: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 2 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 2, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 2, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 2, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 3, bar: 1, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
    },
    pot7: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 2, rec: 1 } },
      puncheur: { type: 'fixed', deltas: { mo: 1, val: 2, acc: 2, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 2, end: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 2, end: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pl: 1, pav: 2, bar: 1, end: 1, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 3, bar: 2, end: 3, res: 3 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 4 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
    },
    pot8: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 2, rec: 1 } },
      puncheur: { type: 'fixed', deltas: { mo: 1, val: 2, acc: 2, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 2, end: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 2, end: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pl: 1, pav: 2, bar: 1, end: 1, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 2, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 2, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { pl: 1, acc: 3, bar: 2, end: 3, res: 3 } },
      point_faible: { type: 'note', category: 'secondaire', points: 5, extra: { bar: 4 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
    },
  },
  22: {
    pot1: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, des: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1 } },
      complet_plat: { type: 'fixed', deltas: { pav: 1, sp: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3 },
      perfection: { type: 'note', category: 'secondaire', points: 1 },
    },
    pot2: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1 } },
      complet_plat: { type: 'fixed', deltas: { clm: 1, pav: 1, sp: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 1 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot3: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, val: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 1, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1, end: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, pav: 1, sp: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, bar: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot4: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 1, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot5: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 1, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
    pot6: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 2 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 2, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 2, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 2, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
    pot7: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 2 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 2, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 2, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 2, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 3, bar: 2, end: 3, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
    },
    pot8: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 2 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 2, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 2, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 2, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 2 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 3, bar: 2, end: 3, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 4 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
    },
  },
  23: {
    pot1: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, des: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3 },
      perfection: { type: 'note', category: 'secondaire', points: 1 },
    },
    pot2: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1 } },
      complet_plat: { type: 'fixed', deltas: { pav: 1, sp: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 1 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot3: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, bar: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1 } },
      complet_plat: { type: 'fixed', deltas: { clm: 1, pav: 1, sp: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, bar: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot4: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 2, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 2, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, pav: 1, sp: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot5: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 1, bar: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 2, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 2, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
    pot6: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 1, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
    pot7: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 1, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 1, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 1, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 3, bar: 2, end: 3, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
    },
    pot8: {
      grimpeur: { type: 'fixed', deltas: { mo: 2, val: 1, des: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 2, acc: 1, bar: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 2, acc: 1, rec: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 2, prl: 1, rec: 1 } },
      pave: { type: 'fixed', deltas: { pav: 2, bar: 1, end: 1, res: 1 } },
      complet_bosses: { type: 'fixed', deltas: { mo: 1, val: 2, pav: 1, des: 1, bar: 1, res: 1 } },
      complet_plat: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1, pav: 1, sp: 2, end: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 3, bar: 2, end: 3, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 4 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
    },
  },
  24: {
    pot1: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2 },
      perfection: { type: 'note', category: 'secondaire', points: 1 },
    },
    pot2: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot3: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot4: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot5: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot6: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, val: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, end: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
    pot7: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, val: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, end: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
    pot8: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, val: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, end: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 2, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
    },
  },
  25: {
    pot1: {
      point_faible: { type: 'note', category: 'secondaire', points: 2 },
      perfection: { type: 'note', category: 'secondaire', points: 1 },
    },
    pot2: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot3: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot4: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot5: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot6: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
    pot7: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, val: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, end: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
    pot8: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, val: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, end: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 2 } },
      point_faible: { type: 'note', category: 'secondaire', points: 4, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
    },
  },
  26: {
    pot2: {
      point_faible: { type: 'note', category: 'secondaire', points: 2 },
      perfection: { type: 'note', category: 'secondaire', points: 1 },
    },
    pot3: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot4: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot5: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot6: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot7: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
    pot8: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, val: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1, res: 1 } },
      sprinteur: { type: 'fixed', deltas: { pl: 1, sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { pl: 1, clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, end: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 3 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
  },
  27: {
    pot3: {
      point_faible: { type: 'note', category: 'secondaire', points: 2 },
      perfection: { type: 'note', category: 'secondaire', points: 1 },
    },
    pot4: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot5: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot6: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot7: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot8: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, bar: 1, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
    },
  },
  28: {
    pot4: {
      point_faible: { type: 'note', category: 'secondaire', points: 2 },
      perfection: { type: 'note', category: 'secondaire', points: 1 },
    },
    pot5: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot6: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot7: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
    pot8: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 2, end: 2, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 3, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
  },
  29: {
    pot5: {
      point_faible: { type: 'note', category: 'secondaire', points: 2 },
      perfection: { type: 'note', category: 'secondaire', points: 1 },
    },
    pot6: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot7: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot8: {
      grimpeur: { type: 'fixed', deltas: { mo: 1, res: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1, acc: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1, acc: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1, prl: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1, res: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1, res: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
    },
  },
  30: {
    pot6: {
      point_faible: { type: 'note', category: 'secondaire', points: 2 },
      perfection: { type: 'note', category: 'secondaire', points: 1 },
    },
    pot7: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 1 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
    pot8: {
      grimpeur: { type: 'fixed', deltas: { mo: 1 } },
      puncheur: { type: 'fixed', deltas: { val: 1 } },
      sprinteur: { type: 'fixed', deltas: { sp: 1 } },
      rouleur: { type: 'fixed', deltas: { clm: 1 } },
      pave: { type: 'fixed', deltas: { pav: 1 } },
      secondaire: { type: 'fixed', deltas: { acc: 1, end: 1 } },
      point_faible: { type: 'note', category: 'secondaire', points: 2, extra: { bar: 2 } },
      perfection: { type: 'note', category: 'secondaire', points: 2 },
    },
  },
};

/** Renvoie les gains pour un âge / palier de potentiel / entraînement donnés. */
export function getTrainingGain(
  age: number,
  potTierKey: string,
  trainingKey: string,
): TrainingGain | undefined {
  return BAREME[age]?.[potTierKey]?.[trainingKey];
}

// ── Régression (31 ans et plus) ────────────────────────────────────────────────
//
// Au-delà de ce que couvre le barème d'entraînement (30 ans), les 3 meilleures
// stats du coureur perdent chacune `magnitude` points, chaque saison. L'âge à
// utiliser est celui du coureur en fin de saison en cours. Le palier 35 ans
// s'applique tel quel à tout âge supérieur (aucune donnée au-delà).
export const REGRESSION_TABLE: Record<number, Record<string, number>> = {
  31: { pot1: 1, pot2: 1, pot3: 1, pot4: 1, pot5: 1, pot6: 1, pot7: 1, pot8: 1 },
  32: { pot1: 2, pot2: 2, pot3: 2, pot4: 2, pot5: 2, pot6: 2, pot7: 2, pot8: 2 },
  33: { pot1: 2, pot2: 2, pot3: 2, pot4: 2, pot5: 2, pot6: 2, pot7: 2, pot8: 2 },
  34: { pot1: 3, pot2: 3, pot3: 3, pot4: 3, pot5: 3, pot6: 3, pot7: 2, pot8: 2 },
  35: { pot1: 3, pot2: 3, pot3: 3, pot4: 3, pot5: 3, pot6: 3, pot7: 3, pot8: 2 },
};

/** Number of top stats hit by a regression event ("Meilleure Stat (x3)"). */
export const REGRESSION_STAT_COUNT = 3;

export const FIRST_REGRESSION_AGE = 31;

/** Returns undefined below 31 (barème d'entraînement s'applique à la place). */
export function getRegressionMagnitude(age: number, potTierKey: string): number | undefined {
  if (age < FIRST_REGRESSION_AGE) return undefined;
  const key = Math.min(age, 35);
  return REGRESSION_TABLE[key]?.[potTierKey];
}
