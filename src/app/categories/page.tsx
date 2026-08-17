import { prisma } from "@/lib/prisma";
import { createCategory } from "@/lib/actions";
import { parsePointsByRank } from "@/lib/points";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-sm text-[var(--text-dim)]">
          Your own points scales. Each race picks a category; finishing rank auto-fills points from its scale.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 font-semibold">Existing categories</h2>
          <div className="flex flex-col gap-3">
            {categories.map((c) => (
              <div key={c.id} className="rounded-md border border-[var(--border)] p-3">
                <div className="font-medium">{c.name}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-[var(--text-dim)]">
                  {parsePointsByRank(c.pointsByRank).map((p, i) => (
                    <span key={i} className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono">
                      #{i + 1}: {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {categories.length === 0 && <p className="text-sm text-[var(--text-dim)]">No categories yet.</p>}
          </div>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 font-semibold">New category</h2>
          <form action={createCategory} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Name
              <input name="name" required placeholder="e.g. Major Tour" className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Points by rank (comma-separated, 1st place first)
              <input name="points" required placeholder="100,80,65,50,40,30,25,20,15,10" className="input" />
            </label>
            <button type="submit" className="btn btn-primary mt-2">
              Create category
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
