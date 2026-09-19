"use client";

import { useMemo, useState } from "react";
import type { RiderRow } from "@/components/RidersStatsTable";
import type { TeamRosterGroup } from "@/lib/queries";
import {
  STAT_KEYS,
  STAT_LABELS,
  TRAININGS,
  NONE_TRAINING,
  toSimRider,
  computeEvolution,
  applyLuck,
  type StatKey,
  type EvolutionRow,
  type LuckResult,
} from "@/lib/trainingSim";

interface ColorBand { min: number; max: number; bg: string; fg: string }

const COLOR_BANDS: ColorBand[] = [
  { min: 50, max: 59, bg: "#d1d5db", fg: "#374151" },
  { min: 60, max: 64, bg: "#bfdbfe", fg: "#1e40af" },
  { min: 65, max: 69, bg: "#bbf7d0", fg: "#15803d" },
  { min: 70, max: 71, bg: "#fef08a", fg: "#854d0e" },
  { min: 72, max: 74, bg: "#fed7aa", fg: "#c2410c" },
  { min: 75, max: 79, bg: "#fecaca", fg: "#b91c1c" },
  { min: 80, max: Infinity, bg: "#e8d4bb", fg: "#78350f" },
];

function colorBand(value: number): ColorBand | undefined {
  return COLOR_BANDS.find((b) => value >= b.min && value <= b.max);
}

function tabClass(active: boolean) {
  return `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
    active
      ? "border-[var(--accent)] text-[var(--accent)]"
      : "border-transparent text-[var(--text-dim)] hover:text-[var(--text)]"
  }`;
}

interface Choice {
  trainingKey: string;
  notePick?: StatKey;
}

interface AppliedResult {
  potentielBefore: number;
  current: EvolutionRow; // pre-season stats + the training choice actually used
  luck: LuckResult;
}

// ── Selection mode: one editable row per rider ──────────────────────────────────

function SeasonRow({
  rider,
  choice,
  onChange,
}: {
  rider: RiderRow;
  choice: Choice | undefined;
  onChange: (choice: Choice) => void;
}) {
  const sim = useMemo(() => toSimRider(rider), [rider]);

  if (!sim) {
    return (
      <tr>
        <td colSpan={STAT_KEYS.length + 4} className="px-3 py-2 text-sm text-[var(--text-dim)]">
          {rider.firstName} {rider.lastName} — âge ou potentiel manquant.
        </td>
      </tr>
    );
  }

  const plan = choice ? { [sim.age]: choice } : {};
  const rows = computeEvolution(sim, plan, sim.age);
  const current = rows[0];
  const projected = rows[1]; // undefined when this age has no training data (e.g. > 30)

  return (
    <tr className="bg-[var(--surface)]">
      <td className="whitespace-nowrap px-2 py-1.5">
        <div className="font-medium text-[var(--text)]">{rider.firstName} {rider.lastName}</div>
        {rider.teamName && <div className="text-xs text-[var(--text-dim)]">{rider.teamName}</div>}
      </td>
      <td className="px-2 py-1.5 text-center font-mono">{sim.age}</td>
      <td className="px-2 py-1.5 text-center font-mono">{sim.potentiel}</td>
      {STAT_KEYS.map((k) => {
        const value = current.stats[k];
        const next = projected?.stats[k];
        const band = colorBand(value);
        return (
          <td
            key={k}
            className="px-2 py-1.5 text-center font-mono"
            style={band ? { backgroundColor: band.bg, color: band.fg } : undefined}
          >
            <div>{value}</div>
            {next != null && next !== value && (
              <div
                className={`mt-0.5 inline-block rounded px-1.5 py-0.5 font-sans text-[11px] font-bold leading-none text-white ${
                  next > value ? "bg-green-600" : "bg-red-600"
                }`}
              >
                → {next}
              </div>
            )}
          </td>
        );
      })}
      <td className="whitespace-nowrap px-2 py-1.5">
        {current.regression ? (
          <RegressionLabel regression={current.regression} />
        ) : current.availableTrainings.length === 0 ? (
          <span className="text-xs text-[var(--text-dim)]">Aucune donnée</span>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={current.trainingKey}
              onChange={(e) => onChange({ trainingKey: e.target.value })}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs text-[var(--text)]"
            >
              {current.availableTrainings.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            {current.notePick && (
              <select
                value={current.notePick}
                onChange={(e) => onChange({ trainingKey: current.trainingKey, notePick: e.target.value as StatKey })}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs text-[var(--text)]"
              >
                {current.noteCategory.map((k) => (
                  <option key={k} value={k}>+{current.notePoints} {STAT_LABELS[k]}</option>
                ))}
              </select>
            )}
            {current.notePoints > 0 && !current.notePick && (
              <span className="text-xs text-[var(--text-dim)]">Notes au plafond</span>
            )}
            {current.cappedStats.length > 0 && (
              <span
                className="text-xs text-amber-600"
                title={`Plafond atteint, gain perdu sur : ${current.cappedStats.map((k) => STAT_LABELS[k]).join(", ")}`}
              >
                ⚠
              </span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function RegressionLabel({ regression }: { regression: { magnitude: number; stats: StatKey[] } }) {
  return (
    <span
      className="text-xs font-semibold text-red-700"
      title={`3 meilleures stats -${regression.magnitude} : ${regression.stats.map((k) => STAT_LABELS[k]).join(", ")}`}
    >
      📉 Régression -{regression.magnitude} × {regression.stats.map((k) => STAT_LABELS[k]).join(", ")}
    </span>
  );
}

function SeasonTable({
  riders,
  choices,
  onChoiceChange,
  season,
}: {
  riders: RiderRow[];
  choices: Record<string, Choice>;
  onChoiceChange: (riderId: string, choice: Choice) => void;
  season: number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--surface-2)] text-xs uppercase text-[var(--text-dim)]">
          <tr>
            <th className="px-2 py-2 text-left">Coureur</th>
            <th className="px-2 py-2 text-center">Âge</th>
            <th className="px-2 py-2 text-center">POT</th>
            {STAT_KEYS.map((k) => (
              <th key={k} className="px-2 py-2 text-center">{STAT_LABELS[k]}</th>
            ))}
            <th className="px-2 py-2 text-left">Entraînement S{season}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {riders.map((r) => (
            <SeasonRow key={r.id} rider={r} choice={choices[r.id]} onChange={(c) => onChoiceChange(r.id, c)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Results mode: training + lucky/unlucky roll applied, read-only ──────────────

/** Visuals for a lucky (positive) or unlucky (negative) swing — bigger magnitude reads louder. */
function luckBadge(delta: number): { className: string; icon: string } {
  const magnitude = Math.min(3, Math.abs(delta));
  const lucky = delta > 0;
  const icon = (lucky ? "🍀" : "💥").repeat(magnitude);
  const className =
    magnitude >= 3
      ? lucky
        ? "bg-amber-600 ring-2 ring-amber-300"
        : "bg-red-700 ring-2 ring-red-400"
      : magnitude === 2
        ? lucky ? "bg-amber-500" : "bg-red-600"
        : lucky ? "bg-amber-400" : "bg-red-500";
  return { className, icon };
}

function ResultRow({ rider, result }: { rider: RiderRow; result: AppliedResult }) {
  const { current, luck } = result;
  const trainingLabel = [NONE_TRAINING, ...TRAININGS].find((t) => t.key === current.trainingKey)?.label;
  const noteLabel = current.notePick ? ` (+${current.notePoints} ${STAT_LABELS[current.notePick]})` : "";

  return (
    <tr className="bg-[var(--surface)]">
      <td className="whitespace-nowrap px-2 py-1.5">
        <div className="font-medium text-[var(--text)]">{rider.firstName} {rider.lastName}</div>
        {rider.teamName && <div className="text-xs text-[var(--text-dim)]">{rider.teamName}</div>}
      </td>
      <td className="px-2 py-1.5 text-center font-mono">{current.age}</td>
      <td className="px-2 py-1.5 text-center font-mono">
        <div>{result.potentielBefore}</div>
        {luck.potentielDelta !== 0 && (() => {
          const { className, icon } = luckBadge(luck.potentielDelta);
          return (
            <div className={`mt-0.5 inline-block rounded ${className} px-1.5 py-0.5 font-sans text-[11px] font-bold leading-none text-white`}>
              {icon} → {luck.potentiel}
            </div>
          );
        })()}
      </td>
      {STAT_KEYS.map((k) => {
        const base = current.stats[k];
        const final = luck.finalStats[k];
        const band = colorBand(base);
        const luckDelta = luck.luckStats[k];
        const changed = final !== base;
        const { className, icon } = luckDelta
          ? luckBadge(luckDelta)
          : { className: final > base ? "bg-green-600" : "bg-red-600", icon: "" };
        return (
          <td
            key={k}
            className="px-2 py-1.5 text-center font-mono"
            style={band ? { backgroundColor: band.bg, color: band.fg } : undefined}
          >
            <div>{base}</div>
            {changed && (
              <div className={`mt-0.5 inline-block rounded ${className} px-1.5 py-0.5 font-sans text-[11px] font-bold leading-none text-white`}>
                {icon}{icon && " "}→ {final}
              </div>
            )}
          </td>
        );
      })}
      <td className="whitespace-nowrap px-2 py-1.5 text-xs text-[var(--text)]">
        {current.regression ? (
          <RegressionLabel regression={current.regression} />
        ) : current.availableTrainings.length === 0 ? (
          <span className="text-[var(--text-dim)]">Aucune donnée</span>
        ) : (
          `${trainingLabel}${noteLabel}`
        )}
      </td>
    </tr>
  );
}

/** One tab-separated line per trained rider — pastes straight into Excel as columns,
 * same column order as the sheets used to import a roster (Nom/Prénom/Pays/Âge/POT/
 * 13 stats/MOY). Age is bumped +1 and moyenne recomputed from the final stats, since
 * this represents the rider as they'll be next season. */
function buildExcelBlock(riders: RiderRow[], results: Record<string, AppliedResult>): string {
  const lines = riders.flatMap((r) => {
    const result = results[r.id];
    if (!result) return [];
    const stats = result.luck.finalStats;
    const moyenne = STAT_KEYS.reduce((sum, k) => sum + stats[k], 0) / STAT_KEYS.length;
    return [
      [
        r.lastName,
        r.firstName,
        r.nationality ?? "",
        result.current.age + 1,
        result.luck.potentiel,
        ...STAT_KEYS.map((k) => stats[k]),
        moyenne.toFixed(2),
      ].join("\t"),
    ];
  });
  return lines.join("\n");
}

function ResultsTable({
  riders,
  results,
  season,
}: {
  riders: RiderRow[];
  results: Record<string, AppliedResult>;
  season: number;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-dim)]">
        🍀 coup de chance (+1 à +3 inattendu, même hors plafond normal, jusqu&apos;à 82) · 💥 coup de malchance (-1 à
        -3, jusqu&apos;à 50) — plus il y a d&apos;icônes, plus le coup est rare. Aperçu uniquement, rien n&apos;est
        sauvegardé : reporte les valeurs toi-même.
      </p>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] text-xs uppercase text-[var(--text-dim)]">
            <tr>
              <th className="px-2 py-2 text-left">Coureur</th>
              <th className="px-2 py-2 text-center">Âge</th>
              <th className="px-2 py-2 text-center">POT</th>
              {STAT_KEYS.map((k) => (
                <th key={k} className="px-2 py-2 text-center">{STAT_LABELS[k]}</th>
              ))}
              <th className="px-2 py-2 text-left">Entraînement S{season}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {riders.map((r) => {
              const result = results[r.id];
              if (!result) {
                return (
                  <tr key={r.id}>
                    <td colSpan={STAT_KEYS.length + 4} className="px-3 py-2 text-sm text-[var(--text-dim)]">
                      {r.firstName} {r.lastName} — âge ou potentiel manquant.
                    </td>
                  </tr>
                );
              }
              return <ResultRow key={r.id} rider={r} result={result} />;
            })}
          </tbody>
        </table>
      </div>

      <details className="group rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <summary className="cursor-pointer select-none text-sm font-medium text-[var(--text-dim)] hover:text-[var(--accent)]">
          Copier pour Excel (âge saison {season})
        </summary>
        <textarea
          readOnly
          rows={Math.min(riders.length + 2, 20)}
          value={buildExcelBlock(riders, results)}
          onFocus={(e) => e.currentTarget.select()}
          className="input mt-3 w-full font-mono text-xs"
        />
      </details>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────────

export function SingleSeasonTraining({
  teams,
  riders,
  season,
}: {
  teams: TeamRosterGroup[];
  riders: RiderRow[];
  season: number;
}) {
  const [tab, setTab] = useState<"teams" | "individual">("teams");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [mode, setMode] = useState<"select" | "results">("select");
  const [resultRiders, setResultRiders] = useState<RiderRow[]>([]);
  const [results, setResults] = useState<Record<string, AppliedResult>>({});

  const activeTeam = teams.find((t) => t.id === teamId) ?? teams[0];

  const filteredRiders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = q ? riders.filter((r) => `${r.firstName} ${r.lastName}`.toLowerCase().includes(q)) : riders;
    return pool.slice(0, 24);
  }, [riders, search]);

  const selectedRider = riders.find((r) => r.id === selectedId) ?? null;

  function setChoice(riderId: string, choice: Choice) {
    setChoices((c) => ({ ...c, [riderId]: choice }));
  }

  function train(ridersToTrain: RiderRow[]) {
    const next: Record<string, AppliedResult> = {};
    for (const r of ridersToTrain) {
      const sim = toSimRider(r);
      if (!sim) continue;
      const choice = choices[r.id];
      const plan = choice ? { [sim.age]: choice } : {};
      const rows = computeEvolution(sim, plan, sim.age);
      const current = rows[0];
      const trainedStats = rows[1]?.stats ?? current.stats;
      next[r.id] = { potentielBefore: sim.potentiel, current, luck: applyLuck(trainedStats, sim.potentiel) };
    }
    setResults(next);
    setResultRiders(ridersToTrain);
    setMode("results");
  }

  function backToSelection() {
    setMode("select");
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-[var(--border)]">
        <button
          onClick={() => { setTab("teams"); setMode("select"); }}
          className={tabClass(tab === "teams")}
        >
          Par équipe
        </button>
        <button
          onClick={() => { setTab("individual"); setMode("select"); }}
          className={tabClass(tab === "individual")}
        >
          Simulateur individuel
        </button>
      </div>

      {tab === "teams" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTeamId(t.id); setMode("select"); }}
                className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
                style={
                  t.id === teamId
                    ? { borderColor: "var(--accent)", color: "var(--accent)", background: "var(--surface-2)" }
                    : { borderColor: "var(--border)", color: "var(--text-dim)" }
                }
              >
                {t.name} <span className="opacity-70">({t.riders.length})</span>
              </button>
            ))}
          </div>

          {activeTeam ? (
            mode === "results" ? (
              <div className="space-y-3">
                <button onClick={backToSelection} className="text-xs text-[var(--text-dim)] underline">
                  ← Modifier les entraînements
                </button>
                <ResultsTable riders={resultRiders} results={results} season={season} />
              </div>
            ) : (
              <div className="space-y-3">
                <SeasonTable riders={activeTeam.riders} choices={choices} onChoiceChange={setChoice} season={season} />
                <button
                  onClick={() => train(activeTeam.riders)}
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  🎲 Entraîner l&apos;équipe
                </button>
              </div>
            )
          ) : (
            <p className="text-sm text-[var(--text-dim)]">Aucune équipe avec un effectif actif.</p>
          )}
        </div>
      )}

      {tab === "individual" && (
        <div className="space-y-4">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedId(null);
              setMode("select");
            }}
            placeholder="Rechercher un coureur..."
            className="w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
          />

          {!selectedRider && (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRiders.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setSelectedId(r.id); setMode("select"); }}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-left text-sm hover:border-[var(--accent)]"
                >
                  <div className="font-medium text-[var(--text)]">{r.firstName} {r.lastName}</div>
                  <div className="text-xs text-[var(--text-dim)]">{r.teamName ?? "Agent libre"} · {r.age} ans · POT {r.potential}</div>
                </button>
              ))}
              {filteredRiders.length === 0 && (
                <p className="text-sm text-[var(--text-dim)]">Aucun coureur ne correspond à cette recherche.</p>
              )}
            </div>
          )}

          {selectedRider && (
            <div className="space-y-2">
              <button
                onClick={() => { setSelectedId(null); setMode("select"); }}
                className="text-xs text-[var(--text-dim)] underline"
              >
                ← Choisir un autre coureur
              </button>

              {mode === "results" ? (
                <div className="space-y-3">
                  <button onClick={backToSelection} className="text-xs text-[var(--text-dim)] underline">
                    ← Modifier l&apos;entraînement
                  </button>
                  <ResultsTable riders={resultRiders} results={results} season={season} />
                </div>
              ) : (
                <div className="space-y-3">
                  <SeasonTable riders={[selectedRider]} choices={choices} onChoiceChange={setChoice} season={season} />
                  <button
                    onClick={() => train([selectedRider])}
                    className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    🎲 Entraîner
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
