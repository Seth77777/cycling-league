import { createTeam } from "@/lib/actions";
import { requireAdmin } from "@/lib/session";

export default async function NewTeamPage() {
  await requireAdmin();
  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Nouvelle équipe</h1>
      <form action={createTeam} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Nom
          <input name="name" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Pays
          <input name="country" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Manager
          <input name="manager" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Couleur
          <input name="color" type="color" defaultValue="#ffb703" className="input h-10" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="excludeFromRankings" type="checkbox" />
          Équipe factice (ex. Team Simu) — exclure ses coureurs des classements
        </label>
        <button type="submit" className="btn btn-primary mt-2">
          Créer l&apos;équipe
        </button>
      </form>
    </div>
  );
}
