import { prisma } from "@/lib/prisma";
import { createRace } from "@/lib/actions";
import { getLatestSeason } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";

export default async function NewRacePage() {
  await requireAdmin();
  const [categories, latestSeason] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    getLatestSeason(),
  ]);
  const existingCount = await prisma.race.count({
    where: { season: latestSeason, resultKind: "race", parentRaceId: null },
  });

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">New race</h1>
      {categories.length === 0 ? (
        <p className="text-sm text-[var(--text-dim)]">
          You need at least one category (points scale) before creating a race. Go to{" "}
          <a href="/rankings?view=baremes" className="text-[var(--accent)] hover:underline">
            Classement → Barèmes
          </a>{" "}
          first.
        </p>
      ) : (
        <form action={createRace} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Race name
            <input name="name" required className="input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Pays
            <input name="country" placeholder="ex. FRA" className="input" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Ordre dans le calendrier
              <input name="order" type="number" min={1} defaultValue={existingCount + 1} className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Season
              <input name="season" type="number" required defaultValue={latestSeason} className="input" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Category (points scale)
            <select name="categoryId" required className="input">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary mt-2">
            Create race
          </button>
        </form>
      )}
    </div>
  );
}
