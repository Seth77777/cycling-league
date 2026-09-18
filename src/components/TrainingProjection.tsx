"use client";

import { useMemo, useState } from "react";
import type { RiderRow } from "@/components/RidersStatsTable";
import type { TeamRosterGroup } from "@/lib/queries";
import {
  STAT_KEYS,
  STAT_LABELS,
  DEFAULT_END_AGE,
  getPotTier,
  toSimRider,
  computeEvolution,
  type StatKey,
  type Plan,
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

// ── Per-rider evolution table ──────────────────────────────────────────────────

export function RiderEvolutionTable({ rider }: { rider: RiderRow }) {
  const [plan, setPlan] = useState<Plan>({});
  const sim = useMemo(() => toSimRider(rider), [rider]);

  if (!sim) {
    return (
      <p className="p-3 text-sm text-[var(--text-dim)]">
        {rider.firstName} {rider.lastName} — âge ou potentiel manquant, projection impossible.
      </p>
    );
  }

  const potTier = getPotTier(sim.potentiel);
  const rows = computeEvolution(sim, plan);

  const setTraining = (age: number, trainingKey: string) => {
    setPlan((p) => ({ ...p, [age]: { trainingKey } }));
  };
  const setNotePick = (age: number, statKey: StatKey, trainingKey: string) => {
    setPlan((p) => ({ ...p, [age]: { trainingKey, notePick: statKey } }));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
        <span className="font-semibold text-[var(--text)]">
          {rider.firstName} {rider.lastName}
        </span>
        <span className="text-xs text-[var(--text-dim)]">{sim.age} ans</span>
        <span className="text-xs text-[var(--text-dim)]">
          {potTier.label} (plafond principales {potTier.max})
        </span>
        {rider.teamName && <span className="text-xs text-[var(--text-dim)]">· {rider.teamName}</span>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] text-xs uppercase text-[var(--text-dim)]">
            <tr>
              <th className="px-2 py-2 text-center">Âge</th>
              {STAT_KEYS.map((k) => (
                <th key={k} className="px-2 py-2 text-center">{STAT_LABELS[k]}</th>
              ))}
              <th className="px-2 py-2 text-left">Entraînement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row) => {
              const isFinal = row.age > DEFAULT_END_AGE;
              const rowClass = isFinal
                ? "bg-[var(--surface-2)] font-semibold"
                : row.regression
                  ? "bg-[var(--surface-2)]"
                  : "bg-[var(--surface)]";
              return (
                <tr key={row.age} className={rowClass}>
                  <td className="px-2 py-1.5 text-center font-mono">{isFinal ? `${row.age}+` : row.age}</td>
                  {STAT_KEYS.map((k) => {
                    const value = row.stats[k];
                    const band = colorBand(value);
                    return (
                      <td
                        key={k}
                        className="px-2 py-1.5 text-center font-mono"
                        style={band ? { backgroundColor: band.bg, color: band.fg } : undefined}
                      >
                        {value}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-2 py-1.5">
                    {isFinal ? (
                      <span className="text-[var(--text-dim)]">—</span>
                    ) : row.regression ? (
                      <span
                        className="font-semibold text-red-700"
                        title={`3 meilleures stats -${row.regression.magnitude} : ${row.regression.stats.map((k) => STAT_LABELS[k]).join(", ")}`}
                      >
                        📉 Régression -{row.regression.magnitude} × {row.regression.stats.map((k) => STAT_LABELS[k]).join(", ")}
                      </span>
                    ) : row.availableTrainings.length === 0 ? (
                      <span className="text-[var(--text-dim)]">Aucune donnée</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={row.trainingKey}
                          onChange={(e) => setTraining(row.age, e.target.value)}
                          className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs text-[var(--text)]"
                        >
                          {row.availableTrainings.map((t) => (
                            <option key={t.key} value={t.key}>{t.label}</option>
                          ))}
                        </select>
                        {row.notePick && (
                          <select
                            value={row.notePick}
                            onChange={(e) => setNotePick(row.age, e.target.value as StatKey, row.trainingKey)}
                            className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs text-[var(--text)]"
                          >
                            {row.noteCategory.map((k) => (
                              <option key={k} value={k}>+{row.notePoints} {STAT_LABELS[k]}</option>
                            ))}
                          </select>
                        )}
                        {row.notePoints > 0 && !row.notePick && (
                          <span className="text-xs text-[var(--text-dim)]">Toutes les notes au plafond</span>
                        )}
                        {row.cappedStats.length > 0 && (
                          <span
                            className="text-xs text-amber-600"
                            title={`Plafond atteint, gain perdu sur : ${row.cappedStats.map((k) => STAT_LABELS[k]).join(", ")}`}
                          >
                            ⚠ {row.cappedStats.map((k) => STAT_LABELS[k]).join(", ")}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Collapsible per-rider block (team view) ─────────────────────────────────────

function RiderTrainingBlock({ rider }: { rider: RiderRow }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="font-medium text-[var(--text)]">{rider.firstName} {rider.lastName}</span>
          <span className="text-xs text-[var(--text-dim)]">{rider.age} ans · POT {rider.potential}</span>
        </span>
        <span className="text-xs text-[var(--text-dim)]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] p-3">
          <RiderEvolutionTable rider={rider} />
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────────

export function TrainingProjection({ teams, riders }: { teams: TeamRosterGroup[]; riders: RiderRow[] }) {
  const [tab, setTab] = useState<"teams" | "individual">("teams");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [riderId, setRiderId] = useState<string | null>(null);

  const activeTeam = teams.find((t) => t.id === teamId) ?? teams[0];

  const filteredRiders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = q ? riders.filter((r) => `${r.firstName} ${r.lastName}`.toLowerCase().includes(q)) : riders;
    return pool.slice(0, 24);
  }, [riders, search]);

  const selectedRider = riders.find((r) => r.id === riderId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-[var(--border)]">
        <button onClick={() => setTab("teams")} className={tabClass(tab === "teams")}>
          Par équipe
        </button>
        <button onClick={() => setTab("individual")} className={tabClass(tab === "individual")}>
          Simulateur individuel
        </button>
      </div>

      {tab === "teams" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setTeamId(t.id)}
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
            <div className="space-y-2">
              {activeTeam.riders.map((r) => (
                <RiderTrainingBlock key={r.id} rider={r} />
              ))}
            </div>
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
              setRiderId(null);
            }}
            placeholder="Rechercher un coureur..."
            className="w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
          />

          {!selectedRider && (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRiders.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRiderId(r.id)}
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
              <button onClick={() => setRiderId(null)} className="text-xs text-[var(--text-dim)] underline">
                ← Choisir un autre coureur
              </button>
              <RiderEvolutionTable rider={selectedRider} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
