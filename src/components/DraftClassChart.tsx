const COLORS = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#f87171", "#22d3ee", "#facc15"];

export function DraftClassChart({
  seasons,
  classes,
  points,
}: {
  seasons: number[];
  classes: number[];
  points: number[][];
}) {
  const width = 900;
  const height = 420;
  const margin = { top: 20, right: 20, bottom: 44, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const maxValue = Math.max(1, ...points.flat());
  const yTicks = 5;
  const niceMax = Math.ceil(maxValue / yTicks / 100) * 100 * yTicks || yTicks;

  const stepX = seasons.length > 1 ? innerWidth / (seasons.length - 1) : 0;
  const xForSeason = (si: number) => (seasons.length > 1 ? margin.left + si * stepX : margin.left + innerWidth / 2);
  const yForValue = (value: number) => margin.top + innerHeight - (value / niceMax) * innerHeight;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible">
        <style>
          {`
            .chart-hit { cursor: pointer; }
            .chart-tooltip { opacity: 0; pointer-events: none; transition: opacity 0.1s ease; }
            .chart-hit:hover ~ .chart-tooltip { opacity: 1; }
          `}
        </style>

        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const value = (niceMax / yTicks) * i;
          const y = yForValue(value);
          return (
            <g key={i}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="var(--border)" strokeDasharray="2,3" />
              <text x={margin.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--text-dim)">
                {Math.round(value)}
              </text>
            </g>
          );
        })}

        {seasons.map((season, si) => (
          <text
            key={season}
            x={xForSeason(si)}
            y={margin.top + innerHeight + 20}
            textAnchor="middle"
            fontSize={12}
            fill="var(--text-dim)"
          >
            S{season}
          </text>
        ))}

        {classes.map((cls, ci) => {
          const color = COLORS[ci % COLORS.length];
          const linePoints = seasons.map((_, si) => `${xForSeason(si)},${yForValue(points[si][ci])}`).join(" ");
          return (
            <g key={cls}>
              <polyline points={linePoints} fill="none" stroke={color} strokeWidth={2} />
            </g>
          );
        })}

        {classes.map((cls, ci) => {
          const color = COLORS[ci % COLORS.length];
          return seasons.map((season, si) => {
            const value = points[si][ci];
            const x = xForSeason(si);
            const y = yForValue(value);
            const label = `S${season} · Classe S${cls} : ${value} pt${value === 1 ? "" : "s"}`;
            const boxWidth = Math.max(90, label.length * 6.3 + 16);
            const showBelow = y - margin.top < 34;
            const boxY = showBelow ? y + 12 : y - 34;
            const textY = showBelow ? y + 27 : y - 19;
            const boxX = Math.min(Math.max(x - boxWidth / 2, margin.left), width - margin.right - boxWidth);

            return (
              <g key={`${cls}-${season}`}>
                <circle cx={x} cy={y} r={4} fill={color} />
                <circle className="chart-hit" cx={x} cy={y} r={10} fill="transparent" />
                <g className="chart-tooltip">
                  <rect x={boxX} y={boxY} width={boxWidth} height={22} rx={5} fill="#111827" stroke={color} strokeWidth={1} />
                  <text x={boxX + boxWidth / 2} y={textY} textAnchor="middle" fontSize={11} fill="#f3f4f6">
                    {label}
                  </text>
                </g>
              </g>
            );
          });
        })}

        <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + innerHeight} stroke="var(--border)" />
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={margin.top + innerHeight}
          y2={margin.top + innerHeight}
          stroke="var(--border)"
        />

        <text x={margin.left + innerWidth / 2} y={height - 4} textAnchor="middle" fontSize={12} fill="var(--text-dim)">
          Saison
        </text>
        <text
          x={16}
          y={margin.top + innerHeight / 2}
          textAnchor="middle"
          fontSize={12}
          fill="var(--text-dim)"
          transform={`rotate(-90 16 ${margin.top + innerHeight / 2})`}
        >
          Points
        </text>
      </svg>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {classes.map((cls, ci) => (
          <span key={cls} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[ci % COLORS.length] }} />
            Classe S{cls}
          </span>
        ))}
      </div>
    </div>
  );
}
