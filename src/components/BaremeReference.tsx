import {
  TRAININGS,
  POT_TIERS,
  getTrainingGain,
  formatTrainingGain,
  REGRESSION_TABLE,
  FIRST_REGRESSION_AGE,
} from "@/lib/trainingSim";

const TRAINING_AGES = Array.from({ length: 13 }, (_, i) => 18 + i); // 18..30
const REGRESSION_AGES = Array.from({ length: 5 }, (_, i) => FIRST_REGRESSION_AGE + i); // 31..35(+)

function ageLabel(age: number): string {
  return age === 35 ? "35+" : String(age);
}

export function BaremeReference() {
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1.5 text-xs">
        {[...TRAINING_AGES, ...REGRESSION_AGES].map((age) => (
          <a
            key={age}
            href={`#age-${age}`}
            className="rounded border border-[var(--border)] px-2 py-1 text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {ageLabel(age)}
          </a>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] text-xs uppercase text-[var(--text-dim)]">
            <tr>
              <th className="px-2 py-2 text-center">Âge</th>
              <th className="px-2 py-2 text-left">Entraînement</th>
              {POT_TIERS.map((t) => (
                <th key={t.key} className="whitespace-nowrap px-2 py-2 text-center">
                  {t.label} ({t.max} Max)
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {TRAINING_AGES.map((age) => {
              const rows = TRAININGS.filter((t) => POT_TIERS.some((p) => getTrainingGain(age, p.key, t.key)));
              return rows.map((training, i) => (
                <tr key={`${age}-${training.key}`} id={i === 0 ? `age-${age}` : undefined} className="bg-[var(--surface)]">
                  {i === 0 && (
                    <td
                      rowSpan={rows.length}
                      className="border-r border-[var(--border)] px-2 py-1.5 text-center align-top font-mono font-semibold text-[var(--text)]"
                    >
                      {age}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-2 py-1.5 text-[var(--text)]">{training.label}</td>
                  {POT_TIERS.map((p) => (
                    <td key={p.key} className="whitespace-nowrap px-2 py-1.5 text-center text-xs text-[var(--text-dim)]">
                      {formatTrainingGain(getTrainingGain(age, p.key, training.key))}
                    </td>
                  ))}
                </tr>
              ));
            })}

            {REGRESSION_AGES.map((age) => (
              <tr key={`reg-${age}`} id={`age-${age}`} className="bg-[var(--surface-2)]">
                <td className="border-r border-[var(--border)] px-2 py-1.5 text-center font-mono font-semibold text-[var(--text)]">
                  {ageLabel(age)}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-red-700">Régression</td>
                {POT_TIERS.map((p) => {
                  const magnitude = REGRESSION_TABLE[age]?.[p.key];
                  return (
                    <td key={p.key} className="whitespace-nowrap px-2 py-1.5 text-center text-xs font-semibold text-red-700">
                      {magnitude != null ? `-${magnitude} Meilleure Stat (x3)` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
