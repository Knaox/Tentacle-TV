/**
 * Le câblage de la mise à jour Store dans l'hôte : le Store (koffi), le
 * serveur supervisé, la sauvegarde dans `backups\`, l'icône pour prévenir.
 * Seulement dans le paquet : hors paquet, `StoreContext` n'existe pas.
 */
import { join } from "node:path";
import type { ServerStatus } from "../protocol";
import type { Strings } from "../i18n/strings";
import type { Supervisor } from "../supervisor/supervisor";
import type { BalloonLevel } from "../win32/trayWindow";
import { backupDatabase } from "./backups";
import { registerRestartAfterUpdate } from "./restart";
import { checkStoreUpdate, downloadStoreUpdate, installStoreUpdate } from "./storeUpdate";
import { UpdateCoordinator, type UpdateNotice } from "./updateCoordinator";

export interface HostUpdateInput {
  strings: Strings;
  dataDir: string;
  supervisor: Supervisor;
  /** Relance par le contrôleur : il teste le port d'abord. */
  startServer: () => Promise<void>;
  /** La fenêtre de l'icône, propriétaire du dialogue du Store. */
  window: () => unknown;
  notify: (title: string, text: string, level: BalloonLevel) => void;
  log: (line: string) => void;
}

const STATUS_TIMEOUT_MS = 5_000;

async function serverStatus(supervisor: Supervisor): Promise<ServerStatus | null> {
  const reply = await supervisor.process?.request("status", undefined, STATUS_TIMEOUT_MS);
  // Le contrat (`hostProtocol.ts`) fixe la forme de `result` pour `status`.
  return reply?.type === "tentacle:response" && reply.ok ? (reply.result as ServerStatus) : null;
}

export function createHostUpdate(input: HostUpdateInput): UpdateCoordinator {
  const { strings } = input;
  const notices: Record<UpdateNotice, [string, string, BalloonLevel]> = {
    available: [strings.updateAvailableTitle, strings.updateAvailableBody, "info"],
    failed: [strings.appName, strings.updateFailedBody, "warning"],
    "restart-needed": [strings.appName, strings.updateRestartBody, "info"],
  };
  const coordinator = new UpdateCoordinator({
    store: {
      check: checkStoreUpdate,
      download: downloadStoreUpdate,
      install: (silent) => installStoreUpdate(silent, input.window()),
    },
    server: {
      status: () => serverStatus(input.supervisor),
      running: () => input.supervisor.serverState.kind === "running",
      version: () => {
        const state = input.supervisor.serverState;
        return state.kind === "running" && state.version !== "" ? state.version : "inconnue";
      },
      stop: () => input.supervisor.stop("update"),
      start: input.startServer,
    },
    backup: (version) => backupDatabase(input.dataDir, join(input.dataDir, "backups"), version),
    registerRestart: registerRestartAfterUpdate,
    notify: (notice) => input.notify(...notices[notice]),
    log: (line) => input.log(line),
    now: () => new Date(),
  });
  coordinator.start();
  return coordinator;
}
