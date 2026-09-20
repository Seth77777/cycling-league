"use client";

import { deleteAllResults } from "@/lib/actions";

/** Wipes every result for this race at once — for when the wrong classification
 * entirely was pasted in (e.g. a stage's results into the general classification),
 * rather than removing each row one by one. Confirmed via a native popup since it
 * can't be undone from the UI. */
export function DeleteAllResultsButton({ raceId, raceName, count }: { raceId: string; raceName: string; count: number }) {
  return (
    <form
      action={deleteAllResults}
      onSubmit={(e) => {
        if (!confirm(`Supprimer les ${count} résultat${count === 1 ? "" : "s"} de ${raceName} ?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="raceId" value={raceId} />
      <button type="submit" className="text-xs font-medium text-[var(--danger)] hover:underline">
        Tout supprimer
      </button>
    </form>
  );
}
