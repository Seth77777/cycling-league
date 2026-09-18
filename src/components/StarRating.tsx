/** A 0.5-5 star rating (half-star precision). Each star is its own element so `wave` can stagger them. */
export function StarRating({
  value,
  className,
  glow = false,
  wave = false,
}: {
  value: number;
  className?: string;
  glow?: boolean;
  wave?: boolean;
}) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const remainder = value - i;
    if (remainder >= 1) return "full";
    if (remainder >= 0.5) return "half";
    return "empty";
  });

  return (
    <span className={`inline-flex ${className ?? ""}`} title={`Réputation : ${value}/5`}>
      {stars.map((kind, i) => (
        <span
          key={i}
          className={wave ? "star-wave relative inline-block" : "relative inline-block"}
          style={{
            animationDelay: wave ? `${i * 90}ms` : undefined,
            filter: glow ? "drop-shadow(0 1px 6px color-mix(in srgb, var(--accent) 60%, transparent))" : undefined,
          }}
        >
          <span aria-hidden className="text-[var(--border)]">
            ★
          </span>
          {kind !== "empty" && (
            <span
              aria-hidden
              className="absolute inset-0 overflow-hidden text-[var(--accent)]"
              style={{ width: kind === "half" ? "50%" : "100%" }}
            >
              ★
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
