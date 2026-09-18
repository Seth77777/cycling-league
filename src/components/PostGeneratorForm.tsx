"use client";

import { useActionState } from "react";
import { generateRacePost, type PostState } from "@/lib/postActions";

export function PostGeneratorForm({ raceId }: { raceId: string }) {
  const [state, formAction, pending] = useActionState<PostState, FormData>(generateRacePost, null);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <input type="hidden" name="raceId" value={raceId} />
        <label className="flex flex-col gap-1 text-sm">
          Export PCM (coller le contenu XML du fichier)
          <textarea name="pcmExport" required rows={10} className="input font-mono text-xs" placeholder="<?xml version=..." />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Images (coller un ou plusieurs tags [img]...[/img])
          <textarea name="images" rows={3} className="input font-mono text-xs" placeholder="[img]https://.../podium.jpg[/img]" />
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
