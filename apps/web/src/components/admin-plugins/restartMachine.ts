/**
 * Le suivi d'un redémarrage du serveur, sans React ni réseau : une suite
 * d'échantillons de `/api/health` fait avancer l'état.
 *
 * Le serveur est « revenu » quand un AUTRE processus répond — son `bootId`
 * diffère de celui qui a annoncé le redémarrage. Un serveur qui ne porte pas
 * d'identifiant (d'avant 1.20) est revenu s'il a répondu après une coupure
 * constatée. Passé `STUCK_AFTER_MS`, le suivi continue, mais l'interface dit
 * que le serveur tarde : sans superviseur (Docker…), il ne repart pas seul.
 */

export const STUCK_AFTER_MS = 90_000;

export interface PluginLoadFailure {
  pluginId: string;
  detail?: string;
}

export type RestartPhase =
  | { kind: "idle" }
  | {
      kind: "waiting";
      startedAt: number;
      /** Le processus qui a annoncé le redémarrage ; `null` s'il ne s'est pas nommé. */
      fromBootId: string | null;
      /** Ce qui a demandé le redémarrage (nom de plugin), pour le dire. */
      label: string | null;
      sawDown: boolean;
      stuck: boolean;
    }
  | { kind: "back"; at: number; label: string | null; failures: PluginLoadFailure[] };

export interface HealthSample {
  reachable: boolean;
  bootId?: string | null;
  loadResults?: ReadonlyArray<{ pluginId: string; status: string; detail?: string }>;
}

export function startRestart(fromBootId: string | null | undefined, label: string | null, now: number): RestartPhase {
  return { kind: "waiting", startedAt: now, fromBootId: fromBootId ?? null, label, sawDown: false, stuck: false };
}

/** Les modules serveur qui n'ont pas démarré, d'après le diagnostic de `/api/health`. */
export function loadFailures(sample: HealthSample): PluginLoadFailure[] {
  return (sample.loadResults ?? [])
    .filter((result) => result.status === "error" || result.status === "bad_export")
    .map(({ pluginId, detail }) => ({ pluginId, ...(detail ? { detail } : {}) }));
}

export function onHealthSample(phase: RestartPhase, sample: HealthSample, now: number): RestartPhase {
  if (phase.kind !== "waiting") return phase;
  const stuck = now - phase.startedAt >= STUCK_AFTER_MS;
  if (!sample.reachable) return { ...phase, sawDown: true, stuck };
  const replaced = phase.fromBootId && sample.bootId
    ? sample.bootId !== phase.fromBootId
    : phase.sawDown;
  if (replaced) return { kind: "back", at: now, label: phase.label, failures: loadFailures(sample) };
  return { ...phase, stuck };
}

/** L'intervalle de sonde : serré au début, où le serveur revient d'ordinaire, puis plus lâche. */
export function pollDelay(phase: RestartPhase, now: number): number {
  if (phase.kind !== "waiting") return 0;
  return now - phase.startedAt < 30_000 ? 1000 : 3000;
}
