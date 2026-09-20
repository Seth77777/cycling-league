import Link from "next/link";
import { notFound } from "next/navigation";
import { getRaceDetail, fullName } from "@/lib/queries";
import { createStage, createJersey, bulkAddResults, updateStage } from "@/lib/actions";
import { scaleForRace } from "@/lib/points";
import { isAdmin } from "@/lib/session";
import { RaceLogo } from "@/components/RaceLogo";
import { Flag } from "@/components/Flag";
import { TeamJersey } from "@/components/TeamJersey";
import { DeleteResultButton } from "@/components/DeleteResultButton";
import { DeleteAllResultsButton } from "@/components/DeleteAllResultsButton";

const MEDAL = ["🥇", "🥈", "🥉"];

function resultsSectionTitle(race: { resultKind: string; category: { kind: string } }) {
  if (race.resultKind === "stage") return "Résultats de l'étape";
  if (race.resultKind === "jersey") return "Classement du maillot";
  if (race.category.kind === "grand-tour") return "Général";
  return "Résultats";
}

export default async function RaceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ imported?: string; skipped?: string; gaps?: string }>;
}) {
  const { id } = await params;
  const { imported, skipped, gaps } = await searchParams;
  const race = await getRaceDetail(id);
  if (!race) notFound();

  const admin = await isAdmin();
  const scale = scaleForRace(race.category, race);

  const isGrandTourHub = race.resultKind === "race" && race.category.kind === "grand-tour";
  const stages = race.children.filter((c) => c.resultKind === "stage");
  const jerseys = race.children.filter((c) => c.resultKind === "jersey");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <RaceLogo logoUrl={race.logoUrl ?? race.parent?.logoUrl} className="h-12 w-12 rounded-lg object-contain" />
          <div>
            {race.parent && (
              <Link href={`/races/${race.parent.id}`} className="mb-2 inline-block text-xs text-[var(--accent)] hover:underline">
                ← {race.parent.name}
              </Link>
            )}
            <h1 className="text-2xl font-bold">{race.name}</h1>
          <p className="text-sm text-[var(--text-dim)]">
            Saison {race.season}
            {race.order != null && ` · Ordre #${race.order}`} · {race.category.name}
            {race.country && ` · ${race.country}`}
            {race.resultKind === "stage" && race.isTimeTrial && (
              <span className="ml-2 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--accent)]">
                CLM · ×{race.category.stageTtMultiplier}
              </span>
            )}
            {race.resultKind === "stage" && race.isTeamTimeTrial && (
              <span className="ml-2 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--accent)]">
                CLM par équipes · ×{race.category.stageTtMultiplier}
              </span>
            )}
          </p>
          </div>
        </div>
        {admin && (
          <Link href={`/races/${race.id}/post`} className="btn btn-primary shrink-0">
            Générer le post forum
          </Link>
        )}
      </div>

      {admin && race.resultKind === "stage" && (
        <details className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-[var(--text-dim)] hover:text-[var(--accent)]">
            Modifier l&apos;étape
          </summary>
          <form action={updateStage} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="raceId" value={race.id} />
            <label className="flex items-center gap-2 text-sm">
              <input name="isTimeTrial" type="checkbox" defaultChecked={race.isTimeTrial} /> CLM (contre-la-montre individuel)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="isTeamTimeTrial" type="checkbox" defaultChecked={race.isTeamTimeTrial} /> CLM par équipes
            </label>
            <button type="submit" className="btn btn-primary mt-1 self-start">
              Enregistrer
            </button>
          </form>
        </details>
      )}

      {imported != null && (
        <div className="rounded-lg border border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-sm">
          ✅ {imported} résultat{imported === "1" ? "" : "s"} importé{imported === "1" ? "" : "s"}
          {skipped && Number(skipped) > 0 && ` · ${skipped} ligne${skipped === "1" ? "" : "s"} ignorée${skipped === "1" ? "" : "s"} (coureur non reconnu)`}
        </div>
      )}

      {gaps && (
        <div className="rounded-lg border border-[var(--danger)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--danger)]">
          ⚠️ Rang{gaps.includes(",") ? "s" : ""} manquant{gaps.includes(",") ? "s" : ""} dans le classement : {gaps.split(",").join(", ")}{" "}
          — un coureur à ce rang n&apos;a probablement pas été reconnu.
        </div>
      )}

      {(race.profileUrl ?? race.parent?.profileUrl) && (
        <div className="overflow-hidden rounded-lg border-2 border-[var(--accent)] bg-white p-3">
          <img
            src={race.profileUrl ?? race.parent?.profileUrl ?? undefined}
            alt={`Profil de ${race.name}`}
            className="mx-auto w-full max-w-2xl object-contain"
          />
        </div>
      )}

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{resultsSectionTitle(race)}</h2>
          {admin && race.results.length > 0 && (
            <DeleteAllResultsButton raceId={race.id} raceName={race.name} count={race.results.length} />
          )}
        </div>
        {race.results.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">Aucun résultat pour le moment.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--border)]">
              {race.results.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-2">{r.rank <= 3 ? MEDAL[r.rank - 1] : `#${r.rank}`}</td>
                  <td className="py-2">
                    <Link href={`/riders/${r.riderId}`} className="inline-flex items-center gap-2 hover:text-[var(--accent)]">
                      <Flag nationality={r.rider.nationality} />
                      {fullName(r.rider)}
                    </Link>
                  </td>
                  <td className="py-2 text-[var(--text-dim)]">
                    {r.team ? (
                      <Link href={`/teams/${r.team.id}`} className="inline-flex items-center gap-2 hover:text-[var(--accent)]">
                        <TeamJersey jerseyUrl={r.team.jerseyUrl} color={r.team.color} className="h-6 w-6 rounded" />
                        {r.team.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 text-[var(--text-dim)]">{r.time ?? "—"}</td>
                  <td className="py-2 text-right font-mono">{r.points > 0 ? `${r.points} pts` : ""}</td>
                  {admin && (
                    <td className="py-2 pl-2 text-right">
                      <DeleteResultButton resultId={r.id} riderName={fullName(r.rider)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {admin && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-1 font-semibold">Coller un classement</h2>
          <p className="mb-3 text-xs text-[var(--text-dim)]">
            Une ligne par coureur : rang, nom du coureur, équipe (optionnelle), temps/écart (&quot;s.t.&quot;, &quot;+
            1&apos;24&quot;, &quot;4h15&apos;09&quot;&quot;…) — pas de temps du tout après le nom : considéré comme
            s.t. automatiquement. L&apos;équipe utilisée est celle du coureur pendant la saison de cette course, pas
            celle du texte collé ni son équipe actuelle. Les lignes dont le coureur n&apos;est pas reconnu (fautes de
            frappe, coureurs simulés…) sont ignorées.
            {" "}Barème : {scale.join(" / ") || "non configuré"}
            {race.resultKind === "stage" && race.isTimeTrial && ` (×${race.category.stageTtMultiplier} car CLM)`}
          </p>
          <form action={bulkAddResults} className="flex flex-col gap-3">
            <input type="hidden" name="raceId" value={race.id} />
            <textarea
              name="resultsText"
              required
              rows={12}
              className="input font-mono text-xs"
              placeholder={"1\tDmitri Vlasov\tMonster Energy\t4h15'09\"\n2\tMarcele Azzuri\tHoly Cycling team\ts.t."}
            />
            <button type="submit" className="btn btn-primary self-start">
              Importer
            </button>
          </form>
        </section>
      )}

      {isGrandTourHub && (
        <div className="grid grid-cols-2 gap-6">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="mb-3 font-semibold">Étapes ({stages.length})</h2>
            <div className="flex flex-col gap-2">
              {stages.map((s) => (
                <Link
                  key={s.id}
                  href={`/races/${s.id}`}
                  className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:border-[var(--accent)]"
                >
                  <span>
                    Étape {s.stageNumber}
                    {s.isTimeTrial && <span className="ml-2 text-xs text-[var(--accent)]">CLM</span>}
                  </span>
                  <span className="text-xs text-[var(--text-dim)]">{s._count.results} résultats</span>
                </Link>
              ))}
              {stages.length === 0 && <p className="text-sm text-[var(--text-dim)]">Aucune étape ajoutée.</p>}
            </div>

            {admin && (
              <form action={createStage} className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
                <input type="hidden" name="parentRaceId" value={race.id} />
                <div className="text-xs font-medium text-[var(--text-dim)]">Ajouter une étape</div>
                <div className="flex gap-2">
                  <input name="number" type="number" min={1} placeholder="N°" required className="input w-20" />
                  <label className="flex items-center gap-1 whitespace-nowrap text-xs text-[var(--text-dim)]">
                    <input name="isTimeTrial" type="checkbox" /> CLM
                  </label>
                  <button type="submit" className="btn">
                    Ajouter
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="mb-3 font-semibold">Maillots distinctifs ({jerseys.length})</h2>
            <div className="flex flex-col gap-2">
              {jerseys.map((j) => (
                <Link
                  key={j.id}
                  href={`/races/${j.id}`}
                  className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:border-[var(--accent)]"
                >
                  <span>{j.jerseyName}</span>
                  <span className="text-xs text-[var(--text-dim)]">{j._count.results} résultats</span>
                </Link>
              ))}
              {jerseys.length === 0 && <p className="text-sm text-[var(--text-dim)]">Aucun maillot ajouté.</p>}
            </div>

            {admin && (
              <form action={createJersey} className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
                <input type="hidden" name="parentRaceId" value={race.id} />
                <div className="text-xs font-medium text-[var(--text-dim)]">Ajouter un maillot</div>
                <div className="flex gap-2">
                  <input name="jerseyName" placeholder="ex. Maillot vert" required className="input flex-1" />
                  <button type="submit" className="btn">
                    Ajouter
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
