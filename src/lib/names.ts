/** Case- and accent-insensitive key for matching a pasted/exported rider or team name against the roster — a missing or wrong accent shouldn't turn into a "non reconnu". */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
