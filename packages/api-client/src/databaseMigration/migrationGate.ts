import type { DatabaseMigrationView } from "@tentacle-tv/shared";
import { clearDatabaseMigration, publishDatabaseMigration, readDatabaseMigration, subscribeDatabaseMigration } from "./migrationSignal";
import { startMigrationPoller, type HealthSample, type MigrationPoller } from "./migrationPoller";

/**
 * LA décision de l'écran d'attente de la migration de la base, la même sur
 * toutes les plateformes, sans React : ce que le serveur a dit
 * (`migrationSignal`), filtré par la capacité `server.databaseMigration`.
 *
 * - Au premier signe d'un épisode, la configuration du serveur est RELUE
 *   avant de décider : celle du cache peut venir du serveur d'avant la mise à
 *   jour (1.24, qui ne déclare rien). Rien ne s'affiche avant sa réponse.
 * - Capacité absente : le signe est effacé, jamais d'écran.
 * - Pendant l'écran, `/api/health` est relu toutes les 2 s (`migrationPoller`).
 *   Base prête → `onResume` (requêtes invalidées, socket reconnectée — jamais
 *   le compte). Serveur muet trop longtemps → l'écran s'efface, la règle de
 *   panne de la plateforme reprend la main.
 */
export interface MigrationGateDeps {
  /** Relit `/api/config` (la requête `["app-config"]`). */
  refetchConfig: () => Promise<unknown>;
  /** La configuration relue déclare-t-elle `server.databaseMigration` ? */
  hasCapability: () => boolean;
  fetchHealth: () => Promise<HealthSample | null>;
  onResume: () => void;
  pollIntervalMs?: number;
}

export interface MigrationGate {
  /** La vue à montrer, `null` : rien. */
  read: () => DatabaseMigrationView | null;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
}

export function createMigrationGate(deps: MigrationGateDeps): MigrationGate {
  let phase: "idle" | "checking" | "shown" = "idle";
  let visible: DatabaseMigrationView | null = null;
  let poller: MigrationPoller | null = null;
  let disposed = false;
  const listeners = new Set<() => void>();

  const setVisible = (next: DatabaseMigrationView | null): void => {
    if (visible === next) return;
    visible = next;
    listeners.forEach((listener) => listener());
  };

  const stopPolling = (): void => {
    poller?.stop();
    poller = null;
  };

  const show = (): void => {
    phase = "shown";
    setVisible(readDatabaseMigration());
    poller = startMigrationPoller({
      fetchHealth: deps.fetchHealth,
      onView: publishDatabaseMigration,
      onReady: () => {
        poller = null;
        clearDatabaseMigration();
        deps.onResume();
      },
      onLost: () => {
        poller = null;
        clearDatabaseMigration();
      },
      intervalMs: deps.pollIntervalMs,
    });
  };

  const onSignal = (): void => {
    if (disposed) return;
    const reported = readDatabaseMigration();
    if (!reported) {
      phase = "idle";
      stopPolling();
      setVisible(null);
      return;
    }
    if (phase === "shown") {
      setVisible(reported);
      return;
    }
    if (phase === "checking") return;
    phase = "checking";
    void deps
      .refetchConfig()
      .catch(() => undefined)
      .then(() => {
        if (disposed || phase !== "checking") return;
        if (!readDatabaseMigration()) {
          phase = "idle";
          return;
        }
        if (deps.hasCapability()) show();
        else {
          // Un serveur qui ne déclare pas la capacité : jamais d'écran.
          phase = "idle";
          clearDatabaseMigration();
        }
      });
  };

  const unsubscribe = subscribeDatabaseMigration(onSignal);
  onSignal();

  return {
    read: () => visible,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      disposed = true;
      unsubscribe();
      stopPolling();
    },
  };
}
