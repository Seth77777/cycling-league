import { getPointsByDraftClass } from "@/lib/queries";
import { DraftClassChart } from "@/components/DraftClassChart";

export default async function StatistiquesPage() {
  const { seasons, classes, points } = await getPointsByDraftClass();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Statistiques</h1>
        <p className="text-sm text-[var(--text-dim)]">
          Points inscrits par classe de draft, saison par saison. Les coureurs déjà présents en base en
          saison 1 forment la classe S0 ; les coureurs de la draft de la saison N forment la classe SN.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Points par classe de draft</h2>
        <DraftClassChart seasons={seasons} classes={classes} points={points} />
      </section>
    </div>
  );
}
