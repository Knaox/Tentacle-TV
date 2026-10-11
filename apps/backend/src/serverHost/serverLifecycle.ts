import { closeDatabase } from "../services/db";
import { getAppState } from "../services/configStore";
import { listenForShutdownSignals, serverShutdown } from "../services/lifecycle/serverShutdown";
import { acquireServerLock } from "../services/lifecycle/serverLock";
import { BOOT_ID } from "../services/pluginRestart";
import { BACKEND_VERSION } from "../services/version";
import { notifyHost, startHostChannel } from "./hostChannel";
import { HOST_PROTOCOL_VERSION, SERVER_EXIT_CODES, type StartupFailure } from "./hostProtocol";
import { serverStatus } from "./serverStatus";

/**
 * Le cycle de vie du processus, vu de son superviseur (Docker, ou l'hôte
 * Windows par le canal IPC — `hostProtocol.ts`) : ce qui se pose en tête du
 * démarrage, ce qui s'annonce une fois à l'écoute, et l'échec du démarrage.
 */

/**
 * En tête de `main()`, AVANT toute initialisation : canal de l'hôte, arrêt
 * unique (signaux compris), puis le verrou d'instance. `false` : un autre
 * serveur tient ces données (ou le dossier est en lecture seule) — le
 * processus sort en 1 sans avoir touché à rien.
 */
export async function beginServerLifecycle(): Promise<boolean> {
  startHostChannel({
    shutdown: (reason) => void serverShutdown.run(SERVER_EXIT_CODES.STOPPED, `Arrêt demandé par l'hôte (${reason})`),
    status: serverStatus,
  });
  serverShutdown.register({ closeDatabase });
  listenForShutdownSignals(serverShutdown, SERVER_EXIT_CODES.STOPPED);
  const lock = await acquireServerLock();
  if (!lock.held) {
    await failStartup(lock.reason, lock.detail);
    return false;
  }
  serverShutdown.register({ releaseLock: lock.release });
  return true;
}

/** À l'écoute : l'hôte le sait (et ouvre l'assistant à la première installation). */
export function announceReady(port: number): void {
  void notifyHost({
    type: "tentacle:ready", protocol: HOST_PROTOCOL_VERSION, bootId: BOOT_ID, version: BACKEND_VERSION, port, appState: getAppState(),
  });
}

/** La cause d'un échec de démarrage, dans la liste fermée du protocole. */
export function startupFailureOf(error: unknown): StartupFailure {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "EADDRINUSE" ? "port_in_use" : "unexpected";
}

/** Démarrage impossible : dit à l'hôte (qui ne relancera pas en boucle), puis arrêt propre en 1. */
export async function failStartup(reason: StartupFailure, detail: string): Promise<void> {
  console.error(`[Démarrage] Impossible (${reason}) : ${detail}`);
  await notifyHost({ type: "tentacle:startup-failed", reason, detail: detail.slice(0, 300) });
  await serverShutdown.run(SERVER_EXIT_CODES.FAILED, "Démarrage impossible");
}
