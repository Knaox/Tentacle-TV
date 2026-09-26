import { randomUUID } from "crypto";

/**
 * Le redémarrage du serveur qu'impose le module serveur d'un plugin.
 *
 * Fastify n'enregistre plus de routes une fois à l'écoute : charger, recharger
 * ou décharger le module serveur d'un plugin demande de relancer le processus,
 * que le superviseur (Docker, `restart: unless-stopped`) remet debout. Sans
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
  /** Plafond de l'arrêt propre : un flux vidéo en cours ne doit pas le retenir. */
  shutdownTimeoutMs: number;
  pollMs: number;
}

const DEFAULT_TIMINGS: RestartTimings = {
  exitDelayMs: 1000,
  maxWaitMs: 120_000,
  shutdownTimeoutMs: 3000,
  pollMs: 250,
};

export interface RestartCoordinator {
  isPending: () => boolean;
  /** Une opération sur les fichiers d'un plugin commence ; la fonction rendue la termine. */
  beginOperation: () => () => void;
  /** Idempotent : un second appel ne programme rien de plus. */
  request: (reason: string) => void;
  /** L'arrêt propre du serveur (`app.close()`), tenté avant de sortir. */
  setShutdown: (shutdown: () => Promise<unknown>) => void;
}

export function createRestartCoordinator(
  exit: () => void,
  timings: RestartTimings = DEFAULT_TIMINGS,
): RestartCoordinator {
  let inFlight = 0;
  let pending = false;
  let shutdown: (() => Promise<unknown>) | null = null;

  const finish = async () => {
    // L'arrêt propre rend les baux (collecteur de temps de visionnage, tâches
    // planifiées) : le processus suivant reprend aussitôt au lieu d'attendre
    // leur expiration. Borné, parce qu'une connexion qui ne se ferme pas ne
    // doit pas empêcher le redémarrage qu'on vient d'annoncer.
    if (shutdown) {
      await Promise.race([
        shutdown().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, timings.shutdownTimeoutMs)),
      ]);
    }
    exit();
  };

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
        void finish();
      };
      setTimeout(tick, timings.exitDelayMs);
    },
    setShutdown: (fn) => {
      shutdown = fn;
    },
  };
}

const coordinator = createRestartCoordinator(() => process.exit(0));

export const isRestartPending = coordinator.isPending;
export const beginPluginOperation = coordinator.beginOperation;
export const requestServerRestart = coordinator.request;
export const setRestartShutdown = coordinator.setShutdown;
