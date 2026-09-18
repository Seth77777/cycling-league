/**
 * Team jersey thumbnail. Falls back to a plain color swatch when no jersey image has
 * been set yet — drop files in public/jerseys/ and set Team.jerseyUrl to use one.
 */
export function TeamJersey({
  jerseyUrl,
  color,
  className = "h-4 w-4 rounded-full",
}: {
  jerseyUrl: string | null | undefined;
  color: string | null | undefined;
  className?: string;
}) {
  const base = `inline-block shrink-0 overflow-hidden ${className}`;
  if (jerseyUrl) {
    return <img src={jerseyUrl} alt="" className={`${base} object-cover`} />;
  }
  return <span className={base} style={{ background: color ?? "var(--text-dim)" }} />;
}
