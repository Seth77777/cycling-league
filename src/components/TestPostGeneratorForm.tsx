"use client";

import { useActionState } from "react";
import { generateTestPost, type PostState } from "@/lib/postActions";

export function TestPostGeneratorForm() {
  const [state, formAction, pending] = useActionState<PostState, FormData>(generateTestPost, null);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <label className="flex flex-col gap-1 text-sm">
          Nom de la course (facultatif)
          <input name="raceName" className="input" placeholder="Course de test" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Export PCM (coller le contenu XML du fichier)
          <textarea name="pcmExport" required rows={10} className="input font-mono text-xs" placeholder="<?xml version=..." />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Images (coller un ou plusieurs tags [img]...[/img])
          <textarea name="images" rows={3} className="input font-mono text-xs" placeholder="[img]https://.../podium.jpg[/img]" />
        </label>
        <p className="text-xs text-[var(--text-dim)]">
          Facultatif — pour simuler un cumul sur plusieurs courses (comme le ferait le vrai générateur avec les
          résultats déjà en base) : colle un classement déjà connu, cette course s&apos;y ajoutera au lieu de le
          remplacer. Une entrée par ligne, ex. <code>Recip Erdin 350</code> ou <code>Recip Erdin — 350 pts</code>.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Classement individuel connu (facultatif)
            <textarea name="knownIndiv" rows={4} className="input font-mono text-xs" placeholder={"Recip Erdin 350\nGeorge Bower 300"} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Classement par équipes connu (facultatif)
            <textarea name="knownTeam" rows={4} className="input font-mono text-xs" placeholder={"Scott - Hilti 600\nHoly Cycling Team 450"} />
          </label>
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary self-start">
          {pending ? "Génération…" : "Générer un aperçu"}
        </button>
      </form>

      {state && "error" in state && (
        <div className="rounded-lg border border-[var(--danger)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.error}
        </div>
      )}

      {state && "post" in state && (
        <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm text-[var(--text-dim)]">{state.imported} ligne(s) reconnue(s) dans l&apos;export.</p>
          {state.gaps.length > 0 && (
            <p className="text-sm text-[var(--danger)]">
              ⚠️ Rang{state.gaps.length > 1 ? "s" : ""} manquant{state.gaps.length > 1 ? "s" : ""} dans l&apos;export : {state.gaps.join(", ")}
            </p>
          )}
          <textarea readOnly rows={20} value={state.post} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </div>
  );
}
