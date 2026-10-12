import { randomUUID } from "crypto";
import { SERVER_EXIT_CODES } from "../serverHost/hostProtocol";
import { serverShutdown } from "./lifecycle/serverShutdown";
import { notifyHost } from "../serverHost/hostChannel";

/**
 * Le redémarrage du serveur qu'impose le module serveur d'un plugin.
 *
 * Fastify n'enregistre plus de routes une fois à l'écoute : charger, recharger
 * ou décharger le module serveur d'un plugin demande de relancer le processus,
 * que le superviseur remet debout : Docker (`restart: unless-stopped`, sur tout
 * code) ou l'hôte Windows, qui ne relance QUE sur la sortie 75 (« relance-moi »,
 * `SERVER_EXIT_CODES.RESTART`) — une sortie 0 y veut dire « arrêté ». Sans
 * superviseur, le serveur reste arrêté — l'interface d'administration le dit.
 *
 * Trois garanties que l'ancien `setTimeout(process.exit, 1000)` n'offrait pas :
 * - un identifiant par processus (`BOOT_ID`), relu sur `/api/health` : c'est à
 *   lui que l'interface reconnaît le serveur revenu, au lieu de deviner d'après
 *   une coupure qu'elle aurait pu manquer ;
 * - une opération en vol (téléchargement, extraction d'un AUTRE plugin) n'est
 *   jamais coupée : la sortie l'attend, dans une limite ;
 * - le redémarrage décidé, plus aucune opération ne commence (503) : elle
 *   serait coupée net, fichiers à moitié posés.
 */

export const BOOT_ID = randomUUID();

export interface RestartTimings {
  /** Laisse partir la réponse HTTP qui annonce le redémarrage. */
  exitDelayMs: number;
  /** Plafond d'attente des opérations en vol : téléchargement (60 s) + extraction (30 s). */
  maxWaitMs: number;
  pollMs: number;
}

const DEFAULT_TIMINGS: RestartTimings = {
  exitDelayMs: 1000,
  maxWaitMs: 120_000,
  pollMs: 250,
};

export interface RestartCoordinator {
  isPending: () => boolean;
  /** Une opération sur les fichiers d'un plugin commence ; la fonction rendue la termine. */
  beginOperation: () => () => void;
  /** Idempotent : un second appel ne programme rien de plus. */
  request: (reason: string) => void;
}

/**
 * `restart` reçoit la raison et fait l'arrêt propre puis la sortie 75 — l'arrêt
 * unique du serveur (`lifecycle/serverShutdown.ts`), borné étape par étape.
 */
export function createRestartCoordinator(
  restart: (reason: string) => void,
  timings: RestartTimings = DEFAULT_TIMINGS,
): RestartCoordinator {
  let inFlight = 0;
  let pending = false;

  return {
    isPending: () => pending,
    beginOperation: () => {
      inFlight++;
      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        inFlight--;
      };
    },
    request: (reason) => {
      if (pending) return;
      pending = true;
      console.log(`[Plugins] ${reason} — redémarrage du serveur`);
      const since = Date.now();
      const tick = () => {
        if (inFlight > 0 && Date.now() - since < timings.maxWaitMs) {
          setTimeout(tick, timings.pollMs);
          return;
        }
        restart(reason);
      };
      setTimeout(tick, timings.exitDelayMs);
    },
  };
}

// L'arrêt propre rend les baux (temps de visionnage, tâches planifiées) : le
// processus suivant reprend aussitôt au lieu d'attendre leur expiration.
const coordinator = createRestartCoordinator((reason) => {
  void notifyHost({ type: "tentacle:restarting", detail: reason });
  void serverShutdown.run(SERVER_EXIT_CODES.RESTART, reason);
});

export const isRestartPending = coordinator.isPending;
export const beginPluginOperation = coordinator.beginOperation;
export const requestServerRestart = coordinator.request;
