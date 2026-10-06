import {
  SEGMENT_PLUGIN_KEYS,
  isSegmentPluginInPlace,
  type SegmentPluginOutcome,
  type SegmentRestartOutcome,
  type SegmentSetupError,
  type SegmentSetupPhase,
  type SegmentSetupRun,
} from "@tentacle-tv/shared";

/**
 * L'état d'un passage d'installation des greffons de passages, lu sans faire
 * confiance à la forme (le bureau parle à des serveurs de toutes versions), et
 * ce que l'écran en montre. Module pur, partagé par l'assistant et
 * l'administration.
 */

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

const PHASES: readonly SegmentSetupPhase[] = ["idle", "repositories", "installing", "restarting", "configuring", "done"];
const OUTCOMES: readonly SegmentPluginOutcome[] = ["present", "installed", "enabled", "repo-offline", "unavailable", "too-old", "failed"];
const RESTARTS: readonly SegmentRestartOutcome[] = ["not-needed", "done", "deferred-playing", "timeout", "failed"];
const ERRORS: readonly SegmentSetupError[] = ["not-configured", "unreachable", "rejected", "invalid"];

const oneOf = <T extends string>(list: readonly T[], value: unknown): T | null =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : null;

export function readSegmentRun(raw: unknown): SegmentSetupRun | null {
  if (!isRecord(raw)) return null;
  const phase = oneOf(PHASES, raw.phase);
  if (!phase) return null;
  const listed = Array.isArray(raw.plugins) ? raw.plugins.filter(isRecord) : [];
  const plugins = SEGMENT_PLUGIN_KEYS.map((key) => ({
    key,
    outcome: oneOf(OUTCOMES, listed.find((entry) => entry.key === key)?.outcome),
  }));
  return {
    phase,
    running: raw.running === true,
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : null,
    finishedAt: typeof raw.finishedAt === "string" ? raw.finishedAt : null,
    plugins,
    restart: oneOf(RESTARTS, raw.restart),
    configured: typeof raw.configured === "boolean" ? raw.configured : null,
    error: oneOf(ERRORS, raw.error),
  };
}

/** Les étapes affichées pendant un passage, dans l'ordre. */
export const RUN_STEPS = ["repositories", "installing", "restarting", "configuring"] as const;
export type RunStep = (typeof RUN_STEPS)[number];

/** Où en est chaque étape : faite, en cours, à venir. */
export function stepState(run: SegmentSetupRun, step: RunStep): "done" | "running" | "pending" {
  if (!run.running) return "done";
  const current = RUN_STEPS.indexOf(run.phase as RunStep);
  const index = RUN_STEPS.indexOf(step);
  if (current < 0) return "pending";
  return index < current ? "done" : index === current ? "running" : "pending";
}

export type OutcomeTone = "success" | "warning" | "neutral";

export function outcomeTone(outcome: SegmentPluginOutcome | null): OutcomeTone {
  if (outcome === null) return "neutral";
  return isSegmentPluginInPlace(outcome) ? "success" : "warning";
}

/** Un passage fini qui mérite « Redémarrer maintenant » : différé parce que quelqu'un regardait. */
export function offersRestartAnyway(run: SegmentSetupRun | null): boolean {
  return !!run && !run.running && run.restart === "deferred-playing";
}
