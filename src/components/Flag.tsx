import { nationalityToIso } from "@/lib/nationality";

/** Small country flag for a rider's `nationality` code — renders nothing if unmapped. */
export function Flag({ nationality, className }: { nationality: string | null | undefined; className?: string }) {
  const iso = nationalityToIso(nationality);
  if (!iso) return null;
  return (
    <img
      src={`/flags/${iso}.svg`}
      alt={nationality ?? ""}
      title={nationality ?? undefined}
      className={className ?? "inline-block h-3.5 w-5 shrink-0 rounded-[2px] object-cover align-middle"}
    />
  );
}
