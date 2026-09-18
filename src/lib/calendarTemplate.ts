/** The fixed annual race calendar — same lineup every season, in order. */
export const CALENDAR_TEMPLATE: { name: string; country: string; grandTour: boolean }[] = [
  { name: "Cadel Evans Great Ocean Race", country: "AUS", grandTour: false },
  { name: "Circuit Het Nieuwsblad", country: "BEL", grandTour: false },
  { name: "Strade Bianche", country: "ITA", grandTour: false },
  { name: "Milan - San Remo", country: "ITA", grandTour: false },
  { name: "Grand Prix E3", country: "BEL", grandTour: false },
  { name: "Gand - Wevelgem", country: "BEL", grandTour: false },
  { name: "Tour d'Italie", country: "ITA", grandTour: true },
  { name: "A travers les Flandres", country: "BEL", grandTour: false },
  { name: "Tour des Flandres", country: "BEL", grandTour: false },
  { name: "Paris - Roubaix", country: "FRA", grandTour: false },
  { name: "Amstel Gold Race", country: "NED", grandTour: false },
  { name: "Flèche Wallonne", country: "BEL", grandTour: false },
  { name: "Liège - Bastogne - Liège", country: "BEL", grandTour: false },
  { name: "Tour de France", country: "FRA", grandTour: true },
  { name: "RideLondon - Surrey Classic", country: "GBR", grandTour: false },
  { name: "Classique de Saint-Sébastien", country: "ESP", grandTour: false },
  { name: "EuroEyes Cyclassics", country: "EUR", grandTour: false },
  { name: "Bretagne Classic", country: "FRA", grandTour: false },
  { name: "Grand Prix Cycliste de Québec", country: "CAN", grandTour: false },
  { name: "Grand Prix Cycliste de Montréal", country: "CAN", grandTour: false },
  { name: "Tour d'Espagne", country: "ESP", grandTour: true },
  { name: "Tour de Lombardie", country: "ITA", grandTour: false },
] as const;

export const GRAND_TOUR_STAGE_COUNT = 21;
