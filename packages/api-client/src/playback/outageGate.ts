import type { JellyfinHealthState } from "@tentacle-tv/shared";

/**
 * Le portillon des erreurs d'un lecteur pendant une panne de Jellyfin — la
 * même règle pour le web, le bureau et le mobile (`useOutageGate`), pure :
 *
 *  - Jellyfin en panne (dit par le serveur) : une erreur de lecture n'a
 *    qu'une cause, déjà dite par le bandeau — elle est TUE (ni diagnostic,
 *    ni écran d'erreur, ni bascule de moteur) ;
 *  - Jellyfin revenu : le flux se rouvre, TOUJOURS — mesuré sur le banc web :
 *    une lecture directe dont la réserve s'épuise attend pour toujours, sans
 *    erreur, et ne redemande rien d'elle-même ;
 *  - pendant la reprise (détecteurs encore muets), la première erreur rouvre
 *    une fois de plus (l'ancien flux finit de mourir) ; la suivante est un
 *    vrai problème, diagnostiqué.
 */

export interface OutageGateDeps<F> {
  /** L'état de Jellyfin à l'instant (`getJellyfinHealth().state`). */
  state(): JellyfinHealthState;
  /** Les détecteurs doivent-ils se taire (`playbackErrorsSuppressed`) ? */
  suppressed(): boolean;
  /** Rouvrir le flux à la même position, mêmes pistes, nouvelle session. */
  reopen(): void;
  /** Le chemin ordinaire d'une erreur : diagnostic, écran, gestes. */
  diagnose(failure: F): void;
}

export interface OutageGate<F> {
  report(failure: F): void;
  /** Jellyfin vient de revenir (`recoveries` a changé). */
  recovered(): void;
}

export function createOutageGate<F>(deps: OutageGateDeps<F>): OutageGate<F> {
  let retried = false;
  return {
    report(failure) {
      if (deps.suppressed()) {
        if (deps.state() !== "up") return;
        if (!retried) {
          retried = true;
          deps.reopen();
          return;
        }
      }
      deps.diagnose(failure);
    },
    recovered() {
      retried = false;
      deps.reopen();
    },
  };
}
