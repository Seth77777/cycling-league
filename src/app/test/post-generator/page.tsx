import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { TestPostGeneratorForm } from "@/components/TestPostGeneratorForm";

export default async function TestPostGeneratorPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/races" className="mb-2 inline-block text-xs text-[var(--accent)] hover:underline">
          ← Calendar
        </Link>
        <h1 className="text-2xl font-bold">Bac à sable — Générateur de post</h1>
        <p className="text-sm text-[var(--text-dim)]">
          Page de test : aucune donnée n&apos;est écrite en base ici. Les noms/équipes viennent directement de
          l&apos;export collé, et les classements individuel/équipes sont simulés à partir de ce même export (pas de
          drapeaux, pas de barème réel). Pour un vrai post lié à une course, utilise « Générer le post forum » depuis
          la page de la course.
        </p>
      </div>
      <TestPostGeneratorForm />
    </div>
  );
}
