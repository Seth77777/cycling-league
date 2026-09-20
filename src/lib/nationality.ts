// This league's Rider.nationality column uses ad-hoc 3-letter codes (a mix of French
// abbreviations — ALL/Allemagne, SUE/Suède, DAN/Danemark, JAP/Japon, RTC/République
// Tchèque, CHI/Chine, COR/Corée — and English ones — GER, SWD, SWI, JPN — inconsistent
// across the imported season files). Flag SVGs in public/flags/ are named by ISO
// 3166-1 alpha-2 code, so this maps the exact set of codes present in the current data
// to the right file. BRE is Brésil (French for Brazil), not Bretagne; RTC is the Czech
// Republic, not Russia (that's RUS).
const NATIONALITY_ISO: Record<string, string> = {
  AFS: "za", ALG: "dz", ALL: "de", ARG: "ar", AUS: "au", AUT: "at", BEL: "be", BRE: "br",
  BUL: "bg", CAN: "ca", CHI: "cn", CHL: "cl", CHN: "cn", CIV: "ci", COL: "co", COR: "kr", CRO: "hr", CZE: "cz",
  DAN: "dk", ECU: "ec", EGY: "eg", ESP: "es", EST: "ee", ETH: "et", EUR: "eu", FIN: "fi", FRA: "fr", GBR: "gb",
  GER: "de", GRE: "gr", HON: "hu", IRL: "ie", IRN: "ir", ISL: "is", ISR: "il", ITA: "it",
  JAP: "jp", JPN: "jp", KAZ: "kz", KOR: "kr", LET: "lv", LIT: "lt", LUX: "lu", MEX: "mx", NAM: "na",
  NED: "nl", NOR: "no", NZL: "nz", POL: "pl", POR: "pt", ROM: "ro", ROU: "ro", RTC: "cz", RUS: "ru",
  RWA: "rw", SER: "rs", SLO: "si", SUE: "se", SUI: "ch", SVK: "sk", SVN: "si", SWD: "se", SWI: "ch",
  TUN: "tn", TUR: "tr", UKR: "ua", USA: "us", VEN: "ve",
};

/** Returns the ISO 3166-1 alpha-2 code for a nationality, or null if unknown/unmapped. */
export function nationalityToIso(code: string | null | undefined): string | null {
  if (!code) return null;
  return NATIONALITY_ISO[code.toUpperCase()] ?? null;
}
