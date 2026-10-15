import type { AccountAccessBlocked, AccountAccessState } from "@tentacle-tv/shared";
import { readAccountAccess, reportAccountAccess, subscribeAccountAccess } from "./accountAccessSignal";

/**
 * La porte de l'accès du compte (docs/DROITS-UTILISATEURS.md § 9.1), sans React :
 * tant que le compte est bloqué, elle RELIT la route d'état — à la prochaine
 * ouverture annoncée (`nextOpening`), sinon au plus toutes les cinq minutes
 * (désactivé, plages inconnues : le socket est fermé, rien d'autre ne le dira).
 * Jamais un relevé rapide. Revenu, elle prévient (`onReopened`) et se tait.
 */

/** Au plus tard, la relecture d'un compte bloqué. */
export const ACCESS_RECHECK_MAX_MS = 5 * 60_000;
/** Après l'ouverture annoncée : la règle du serveur doit déjà voir l'autre côté. */
export const ACCESS_OPENING_MARGIN_MS = 2_000;

export type AccountAccessFetch = () => Promise<AccountAccessState | "signedOut" | null>;

export interface AccountAccessGateDeps {
  /** La route d'état ; `signedOut` : la session n'existe plus (401) ; null : pas de réponse exploitable. */
  fetchAccess: AccountAccessFetch;
  /** Le compte a retrouvé l'accès : la plateforme relance ce qui s'était tu. */
  onReopened: () => void;
  now?: () => number;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface AccountAccessGate {
  /** Lire la route maintenant (montage, retour au premier plan). */
  checkNow: () => Promise<void>;
  dispose: () => void;
}

/** Le délai avant la prochaine relecture d'un compte bloqué. */
export function accountAccessRecheckDelay(blocked: AccountAccessBlocked, now: number): number {
  if (blocked.state !== "outsideSchedule" || blocked.nextOpening === null) return ACCESS_RECHECK_MAX_MS;
  return Math.min(ACCESS_RECHECK_MAX_MS, Math.max(0, blocked.nextOpening - now) + ACCESS_OPENING_MARGIN_MS);
}

export function createAccountAccessGate(deps: AccountAccessGateDeps): AccountAccessGate {
  const now = deps.now ?? Date.now;
  const setTimer = deps.setTimer ?? ((run: () => void, ms: number) => setTimeout(run, ms));
  const clearTimer = deps.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let disposed = false;
  let wasBlocked = readAccountAccess() !== null;

  const stop = (): void => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const schedule = (): void => {
    stop();
    const blocked = readAccountAccess();
    // `reconnect` : plus rien à relire, c'est à l'utilisateur de se reconnecter.
    if (!blocked || blocked.state === "reconnect" || disposed) return;
    timer = setTimer(() => {
      timer = null;
      void checkNow();
    }, accountAccessRecheckDelay(blocked, now()));
  };

  const onChange = (): void => {
    if (readAccountAccess()?.state === "reconnect") return stop();
    if (readAccountAccess()) {
      wasBlocked = true;
      schedule();
      return;
    }
    stop();
    if (!wasBlocked) return;
    wasBlocked = false;
    deps.onReopened();
  };

  async function checkNow(): Promise<void> {
    if (disposed) return;
    const result = await deps.fetchAccess().catch(() => null);
    if (disposed) return;
    // Plus de session pendant la page (jeton révoqué à la désactivation) : « Se reconnecter ».
    if (result === "signedOut") {
      if (readAccountAccess()) reportAccountAccess({ state: "reconnect" });
    } else if (result) reportAccountAccess(result);
    // Rien de neuf (même état, ou pas de réponse) : la relecture suivante.
    if (readAccountAccess()) schedule();
  }

  const unsubscribe = subscribeAccountAccess(onChange);
  if (wasBlocked) schedule();

  return {
    checkNow,
    dispose: () => {
      disposed = true;
      stop();
      unsubscribe();
    },
  };
}
