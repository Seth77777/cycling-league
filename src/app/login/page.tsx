import { login } from "@/lib/authActions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 pt-16">
      <h1 className="text-2xl font-bold">Connexion admin</h1>
      <form action={login} className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <label className="flex flex-col gap-1 text-sm">
          Mot de passe
          <input type="password" name="password" autoFocus className="input" />
        </label>
        {error && <p className="text-sm text-[var(--danger)]">Mot de passe incorrect.</p>}
        <button type="submit" className="btn btn-primary">
          Se connecter
        </button>
      </form>
    </div>
  );
}
