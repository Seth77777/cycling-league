import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { PostGeneratorForm } from "@/components/PostGeneratorForm";

export default async function RacePostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const race = await prisma.race.findUnique({ where: { id } });
  if (!race) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/races/${race.id}`} className="mb-2 inline-block text-xs text-[var(--accent)] hover:underline">
          ← {race.name}
        </Link>
        <h1 className="text-2xl font-bold">Générer le post forum</h1>
        <p className="text-sm text-[var(--text-dim)]">
          Colle l&apos;export PCM (Fichier → Exporter au format Excel, puis ouvre le fichier avec le bloc-notes et
          colle son contenu ici). Les résultats sont importés dans la base et le post BBCode est généré en même
          temps.
        </p>
      </div>
      <PostGeneratorForm raceId={race.id} />
      <Link href="/test/post-generator" className="self-start text-xs text-[var(--text-dim)] hover:underline">
        Tester avec des données factices (sans toucher à la base) →
      </Link>
    </div>
  );
}
