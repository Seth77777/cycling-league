/** The fixed annual race calendar — same lineup every season, in order. logoUrl/
 * profileUrl are the same image every year (a race's branding doesn't change
 * season to season), so they live here once rather than needing re-entry on each
 * new season's row — see Race.logoUrl/profileUrl for the file-placement convention. */
export const CALENDAR_TEMPLATE: { name: string; country: string; grandTour: boolean; logoUrl?: string; profileUrl?: string }[] = [
  { name: "Cadel Evans Great Ocean Race", country: "AUS", grandTour: false },
  { name: "Circuit Het Nieuwsblad", country: "BEL", grandTour: false },
  { name: "Strade Bianche", country: "ITA", grandTour: false },
  { name: "Milan - San Remo", country: "ITA", grandTour: false, logoUrl: "/race-logos/milan-san-remo.svg", profileUrl: "/race-profiles/milan-san-remo.jpg" },
  { name: "Grand Prix E3", country: "BEL", grandTour: false },
  { name: "Gand - Wevelgem", country: "BEL", grandTour: false },
  { name: "Tour d'Italie", country: "ITA", grandTour: true, logoUrl: "/race-logos/giro-ditalia.svg" },
  { name: "A travers les Flandres", country: "BEL", grandTour: false },
  { name: "Tour des Flandres", country: "BEL", grandTour: false },
  { name: "Paris - Roubaix", country: "FRA", grandTour: false },
  { name: "Amstel Gold Race", country: "NED", grandTour: false },
  { name: "Flèche Wallonne", country: "BEL", grandTour: false },
  { name: "Liège - Bastogne - Liège", country: "BEL", grandTour: false },
  { name: "Tour de France", country: "FRA", grandTour: true, logoUrl: "/race-logos/tour-de-france.svg" },
  { name: "RideLondon - Surrey Classic", country: "GBR", grandTour: false },
  { name: "Classique de Saint-Sébastien", country: "ESP", grandTour: false },
  { name: "EuroEyes Cyclassics", country: "EUR", grandTour: false },
  { name: "Bretagne Classic", country: "FRA", grandTour: false },
  { name: "Grand Prix Cycliste de Québec", country: "CAN", grandTour: false },
  { name: "Grand Prix Cycliste de Montréal", country: "CAN", grandTour: false },
  { name: "Tour d'Espagne", country: "ESP", grandTour: true, logoUrl: "/race-logos/vuelta.png" },
  { name: "Tour de Lombardie", country: "ITA", grandTour: false },
] as const;

export const GRAND_TOUR_STAGE_COUNT = 21;

/** The 3 secondary classifications every Grand Tour carries alongside the general
 * classification (its own hub race) — created as resultKind="jersey" child races
 * so their results can be pasted in the same way as any other race. */
export const GRAND_TOUR_JERSEYS = ["Montagne", "Sprint", "U25"] as const;

/**
 * The 3 Grand Tours repeat their route on a 2-year cycle — odd seasons use the 2018
 * parcours, even seasons use 2017 — so a stage's profile image only needs 2 variants
 * total, not one per season. `null` slots are stages whose profile hasn't been placed
 * yet; see prisma/backfill-stage-profiles.ts to apply new ones retroactively once they
 * are. File convention: public/race-profiles/<tour-slug>-<2017|2018>-etape-<n>.jpg.
 */
export const GRAND_TOUR_STAGE_PROFILES: Record<string, { y2017: (string | null)[]; y2018: (string | null)[] }> = {
  "Tour d'Italie": { y2017: Array(GRAND_TOUR_STAGE_COUNT).fill(null), y2018: Array(GRAND_TOUR_STAGE_COUNT).fill(null) },
  "Tour de France": { y2017: Array(GRAND_TOUR_STAGE_COUNT).fill(null), y2018: Array(GRAND_TOUR_STAGE_COUNT).fill(null) },
  "Tour d'Espagne": { y2017: Array(GRAND_TOUR_STAGE_COUNT).fill(null), y2018: Array(GRAND_TOUR_STAGE_COUNT).fill(null) },
};

/** logoUrl/profileUrl for one stage of a Grand Tour, given the tour's own season-parity rule. */
export function grandTourStageProfile(tourName: string, stageNumber: number, season: number): string | null {
  const table = GRAND_TOUR_STAGE_PROFILES[tourName];
  if (!table) return null;
  const route = season % 2 === 1 ? table.y2018 : table.y2017;
  return route[stageNumber - 1] ?? null;
}
