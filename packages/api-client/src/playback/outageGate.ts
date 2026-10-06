import {
  decideJellyfinReturn, returnStallDeadline, withinReturnWatch, type JellyfinHealthState,
} from "@tentacle-tv/shared";

/**
 * Le portillon des erreurs d'un lecteur pendant une panne de Jellyfin — la
 * même règle pour le web (et webOS), le bureau et le mobile (`useOutageGate`) ;
 * la décision est dans shared (`jellyfinReturn.ts`) :
 *
 *  - Jellyfin en panne (dit par le serveur) : une erreur de lecture n'a
 *    qu'une cause, déjà dite par le message — elle est TUE (ni diagnostic,
 *    ni écran d'erreur, ni bascule de moteur), et retenue ;
 *  - Jellyfin revenu : la lecture qui a tenu sur sa réserve CONTINUE, rien
 *    ne se recharge (le serveur redit la lecture à Jellyfin). Le flux ne se
 *    rouvre que si la lecture n'avait pas démarré ou s'il est mort pendant
 *    la panne ;
 *  - après le retour (`RETURN_WATCH_MS`), la première erreur, ou une image
 *    arrêtée plus de `RETURN_STALL_MS`, rouvre le flux — une fois par
 *    retour ; la suivante est un vrai problème, diagnostiqué.
 */

export interface OutageGateDeps<F> {
  /** L'état de Jellyfin à l'instant (`getJellyfinHealth().state`). */
  state(): JellyfinHealthState;
  /** La lecture avait-elle démarré (une image affichée) ? */
  started(): boolean;
  /** Rouvrir le flux à la même position, mêmes pistes, nouvelle session. */
  reopen(): void;
  /** Le chemin ordinaire d'une erreur : diagnostic, écran, gestes. */
  diagnose(failure: F): void;
  now?(): number;
  schedule?(run: () => void, ms: number): () => void;
  /** Une ligne par décision (console du lecteur). */
  log?(line: string): void;
}

export interface OutageGate<F> {
  report(failure: F): void;
  /** Jellyfin vient de revenir (`recoveries` a changé). */
  recovered(): void;
  /** Le lecteur attend des données (`true`) ou rejoue (`false`). */
  stalled(on: boolean): void;
  dispose(): void;
}

const defaultSchedule = (run: () => void, ms: number): (() => void) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};

export function createOutageGate<F>(deps: OutageGateDeps<F>): OutageGate<F> {
  const now = deps.now ?? Date.now;
  const schedule = deps.schedule ?? defaultSchedule;
  const log = deps.log ?? (() => undefined);
  let failedDuringOutage = false;
  let returnedAt: number | null = null;
  let reopened = false;
  let stalledSince: number | null = null;
  let cancelStall: (() => void) | null = null;

  const disarm = () => {
    cancelStall?.();
    cancelStall = null;
  };
  const reopenOnce = (why: string) => {
    reopened = true;
    disarm();
    log(`[panne] flux rouvert : ${why}`);
    deps.reopen();
  };
  /** Une image arrêtée après le retour : rouvrir si elle ne repart pas d'elle-même. */
  const armStall = () => {
    disarm();
    const deadline = returnStallDeadline({ now: now(), returnedAt, stalledSince, reopened });
    if (deadline === null) return;
    cancelStall = schedule(() => {
      cancelStall = null;
      if (stalledSince !== null && !reopened && withinReturnWatch(now(), returnedAt)) reopenOnce("image arrêtée après le retour");
    }, Math.max(0, deadline - now()));
  };

  return {
    report(failure) {
      if (deps.state() !== "up") {
        failedDuringOutage = true;
        return;
      }
      if (!reopened && withinReturnWatch(now(), returnedAt)) {
        reopenOnce("erreur après le retour");
        return;
      }
      deps.diagnose(failure);
    },
    recovered() {
      returnedAt = now();
      reopened = false;
      const started = deps.started();
      const action = decideJellyfinReturn({ started, failedDuringOutage });
      failedDuringOutage = false;
      if (action === "reopen") {
        reopenOnce(started ? "flux perdu pendant la panne" : "lecture pas encore démarrée");
        return;
      }
      log("[panne] Jellyfin revenu : lecture gardée, rien n'est rechargé");
      if (stalledSince !== null) armStall();
    },
    stalled(on) {
      if (!on) {
        stalledSince = null;
        disarm();
        return;
      }
      stalledSince ??= now();
      armStall();
    },
    dispose() {
      disarm();
    },
  };
}
