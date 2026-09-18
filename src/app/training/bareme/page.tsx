import Link from "next/link";
import { BaremeReference } from "@/components/BaremeReference";

export default function BaremePage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/training" className="mb-2 inline-block text-xs text-[var(--accent)] hover:underline">
          ← Entraînement
        </Link>
        <h1 className="text-2xl font-bold text-[var(--text)]">Barème</h1>
        <p className="text-sm text-[var(--text-dim)]">
          Référence complète : gains d&apos;entraînement (18-30 ans) et régression automatique (31 ans et plus), par
          palier de potentiel.
        </p>
      </div>
      <BaremeReference />
    </div>
  );
}
