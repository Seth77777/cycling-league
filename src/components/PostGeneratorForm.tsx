"use client";

import { useActionState, useState } from "react";
import { generateRacePost, type PostState } from "@/lib/postActions";

export interface StageOption {
  id: string;
  name: string;
}

interface StageRow {
  raceId: string;
  pcmExport: string;
}

/**
 * `stageOptions` is the Grand Tour's own stage list (siblings of the current race,
 * or the current race's own siblings if it's already a stage) — when non-empty, each
 * row gets a dropdown to pick which stage its pasted export belongs to, and "+
 * Ajouter une étape" lets one post cover a whole block of stages at once. For a
 * plain one-day race there are no siblings, so the form stays exactly as before:
 * one fixed race, one export.
 */
export function PostGeneratorForm({ raceId, stageOptions = [] }: { raceId: string; stageOptions?: StageOption[] }) {
  const [state, formAction, pending] = useActionState<PostState, FormData>(generateRacePost, null);
  const [rows, setRows] = useState<StageRow[]>([{ raceId, pcmExport: "" }]);

  function updateRow(i: number, patch: Partial<StageRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function addRow() {
    setRows((r) => [...r, { raceId: stageOptions[0]?.id ?? raceId, pcmExport: "" }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-[var(--border)] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-dim)]">Étape {i + 1}</span>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} className="text-xs text-[var(--danger)] hover:underline">
                  Retirer
                </button>
              )}
            </div>
            {stageOptions.length > 0 ? (
              <select name="raceId" value={row.raceId} onChange={(e) => updateRow(i, { raceId: e.target.value })} className="input">
                {stageOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input type="hidden" name="raceId" value={row.raceId} />
            )}
            <textarea
              name="pcmExport"
              required
              rows={8}
              value={row.pcmExport}
              onChange={(e) => updateRow(i, { pcmExport: e.target.value })}
              className="input font-mono text-xs"
              placeholder="<?xml version=..."
            />
          </div>
        ))}

        {stageOptions.length > 0 && (
          <button type="button" onClick={addRow} className="self-start text-xs text-[var(--accent)] hover:underline">
            + Ajouter une étape
          </button>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Images (coller un ou plusieurs tags [img]...[/img])
          <textarea
            name="images"
            rows={3}
            className="input font-mono text-xs"
            placeholder="[img]https://.../S1T15.jpg[/img] [img]https://.../GEN.jpg[/img]"
          />
          <span className="text-xs text-[var(--text-dim)]">
            Nom de fichier terminant par S&lt;n&gt; (étape n, capture simple), T15 (top 15 de l&apos;étape correspondante),
            GEN/MO/SPR/U25 (classements du tour) — combinables, ex. « ...S1T15.png ». Sans étiquette reconnue : image
            générique en haut du post.
          </span>
        </label>
        <button type="submit" disabled={pending} className="btn btn-primary self-start">
          {pending ? "Génération…" : "Importer et générer le post"}
        </button>
      </form>

      {state && "error" in state && (
        <div className="rounded-lg border border-[var(--danger)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.error}
        </div>
      )}

      {state && "post" in state && (
        <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm text-[var(--text-dim)]">
            ✅ {state.imported} résultat{state.imported === 1 ? "" : "s"} importé{state.imported === 1 ? "" : "s"}
            {state.skipped > 0 && ` · ${state.skipped} ligne${state.skipped === 1 ? "" : "s"} ignorée${state.skipped === 1 ? "" : "s"} (coureur non reconnu)`}
          </p>
          {state.gaps.length > 0 && (
            <p className="text-sm text-[var(--danger)]">
              ⚠️ Rang{state.gaps.length > 1 ? "s" : ""} manquant{state.gaps.length > 1 ? "s" : ""} dans le classement : {state.gaps.join(", ")} —
              un coureur à ce rang n&apos;a probablement pas été reconnu.
            </p>
          )}
          <textarea readOnly rows={20} value={state.post} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </div>
  );
}
