import { prisma } from "@/lib/prisma";
import { createRace } from "@/lib/actions";

export default async function NewRacePage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">New race</h1>
      {categories.length === 0 ? (
        <p className="text-sm text-[var(--text-dim)]">
          You need at least one category (points scale) before creating a race. Go to{" "}
          <a href="/categories" className="text-[var(--accent)] hover:underline">
            Categories
          </a>{" "}
          first.
        </p>
      ) : (
        <form action={createRace} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Race name
            <input name="name" required className="input" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Date
              <input name="date" type="date" required className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Season
              <input name="season" type="number" required defaultValue={new Date().getFullYear()} className="input" />
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
