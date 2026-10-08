import { DB_MIGRATION_POLL_MS, databaseMigrationOf, type DatabaseMigrationView } from "@tentacle-tv/shared";

/**
 * La relecture de `/api/health` pendant l'écran d'attente : toutes les 2 s,
 * l'une après l'autre (jamais deux en vol), jusqu'à la base prête.
 *
 * Trois issues :
 * - la base n'est pas prête → `onView` (progression, échec et prochain essai) ;
 * - la base est prête, ou le serveur ne dit plus rien de sa base → `onReady` ;
 * - le serveur ne répond plus, `maxFailures` fois de suite → `onLost` : ce
 *   n'est plus une migration, c'est une panne, et la règle de panne de la
 *   plateforme reprend la main. Les quelques secondes de bascule du serveur de
 *   maintenance vers le vrai serveur tiennent largement sous ce seuil.
 */

export interface HealthSample {
  ok: boolean;
  body: unknown;
}

export interface MigrationPollerDeps {
  /** Une lecture de `/api/health` ; `null` : aucune réponse (réseau, délai). */
  fetchHealth: () => Promise<HealthSample | null>;
  onView: (view: DatabaseMigrationView) => void;
  onReady: () => void;
  onLost: () => void;
  intervalMs?: number;
  maxFailures?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/** Échecs de suite avant de rendre la main à la règle de panne (~16 s à 2 s). */
export const MIGRATION_POLL_MAX_FAILURES = 8;

export interface MigrationPoller {
  stop: () => void;
}

export function startMigrationPoller(deps: MigrationPollerDeps): MigrationPoller {
  const intervalMs = deps.intervalMs ?? DB_MIGRATION_POLL_MS;
  const maxFailures = deps.maxFailures ?? MIGRATION_POLL_MAX_FAILURES;
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let stopped = false;
  let failures = 0;
  let timer: unknown = null;

  const schedule = (): void => {
    if (!stopped) timer = setTimer(() => void tick(), intervalMs);
  };

  const tick = async (): Promise<void> => {
    timer = null;
    let sample: HealthSample | null;
    try {
      sample = await deps.fetchHealth();
    } catch {
      sample = null;
    }
    if (stopped) return;
    if (!sample || !sample.ok) {
      failures++;
      if (failures >= maxFailures) {
        stopped = true;
        deps.onLost();
        return;
      }
      schedule();
      return;
    }
    failures = 0;
    const view = databaseMigrationOf(sample.body);
    if (!view) {
      stopped = true;
      deps.onReady();
      return;
    }
    deps.onView(view);
    schedule();
  };

  schedule();
  return {
    stop: () => {
      stopped = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
}

const HEALTH_TIMEOUT_MS = 4000;

/** La lecture par défaut : `GET {backend}/api/health`, sans cache, bornée à 4 s. */
export function fetchHealthSample(backendUrl: string): () => Promise<HealthSample | null> {
  return async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
      const res = await fetch(`${backendUrl}/api/health`, { cache: "no-store", signal: controller.signal });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        /* corps illisible : un `ok` sans `database` vaut une base prête */
      }
      return { ok: res.ok, body };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };
}
