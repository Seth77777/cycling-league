"use client";

import { deleteResult } from "@/lib/actions";

/** A native confirm() popup before submitting — deleting a result can't be undone
 * from the UI, and it's easy to paste a stage's classification into the wrong
 * (e.g. general) results by mistake. */
export function DeleteResultButton({ resultId, riderName }: { resultId: string; riderName: string }) {
  return (
    <form
      action={deleteResult}
      onSubmit={(e) => {
        if (!confirm(`Supprimer le résultat de ${riderName} ?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="resultId" value={resultId} />
      <button type="submit" title="Supprimer ce résultat" className="text-[var(--text-dim)] hover:text-[var(--danger)]">
        ✕
      </button>
    </form>
  );
}
