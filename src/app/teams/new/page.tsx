import { createTeam } from "@/lib/actions";

export default function NewTeamPage() {
  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">New team</h1>
      <form action={createTeam} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input name="name" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Country
          <input name="country" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Color
          <input name="color" type="color" defaultValue="#ffb703" className="input h-10" />
        </label>
        <button type="submit" className="btn btn-primary mt-2">
          Create team
        </button>
      </form>
    </div>
  );
}
