import { prisma } from "@/lib/prisma";
import { createRider } from "@/lib/actions";

export default async function NewRiderPage() {
  const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">New rider</h1>
      <form action={createRider} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            First name
            <input name="firstName" required className="input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Last name
            <input name="lastName" required className="input" />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Nationality
          <input name="nationality" placeholder="e.g. Belgium" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Birth date
          <input name="birthDate" type="date" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Starting team (optional)
          <select name="teamId" className="input">
            <option value="">— Free agent —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Signed on
          <input name="startDate" type="date" className="input" />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
        >
          Create rider
        </button>
      </form>
    </div>
  );
}
