import {
  ACCOUNT_ACCESS_AUTH_ERROR,
  accountAccessRefusalOf,
  accountConnectRefusalOf,
  type AccountConnectRefusalBody,
  isBlockedAccountAccess,
  type AccountAccessBlocked,
  type AccountAccessState,
} from "@tentacle-tv/shared";

/**
 * Ce que le serveur a DIT de l'accès du compte (docs/DROITS-UTILISATEURS.md
 * § 9.1), lisible hors de React : toute réponse 403 `account_access` d'une
 * requête quelconque (client Jellyfin, appels au backend), l'annonce
 * `account:access` du socket et son `auth_error` y déposent l'état ; la porte
 * (`useAccountAccess`) le lit et bascule TOUT DE SUITE.
 */

/**
 * La page à montrer : un état bloqué, ou `reconnect` — la session de CET appareil
 * n'existe plus (Jellyfin révoque les jetons d'un compte qu'on désactive) : le
 * compte, réactivé, doit se reconnecter, jamais rester à moitié connecté.
 */
export type AccountAccessReconnect = { state: "reconnect" };
export type AccountAccessPage = AccountAccessBlocked | AccountAccessReconnect;

let current: AccountAccessPage | null = null;
const listeners = new Set<() => void>();

const notify = (): void => listeners.forEach((listener) => listener());

/** Un état d'accès lu (route, annonce) : bloqué, il s'affiche ; permis, la page se lève. */
export function reportAccountAccess(state: AccountAccessState | AccountAccessReconnect): void {
  const next = state.state === "allowed" ? null : state;
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  notify();
}

/** Un corps de réponse quelconque : vrai s'il disait « compte bloqué » (et l'état est déposé). */
export function reportAccountAccessBody(status: number, body: unknown): boolean {
  if (status !== 403) return false;
  let parsed = body;
  if (typeof body === "string") {
    try {
      parsed = JSON.parse(body);
    } catch {
      return false;
    }
  }
  const blocked = accountAccessRefusalOf(parsed);
  if (blocked) reportAccountAccess(blocked);
  return blocked !== null;
}

/** Une réponse HTTP quelconque : lit une COPIE du corps d'un 403 (l'appelant garde le sien). */
export async function reportAccountAccessResponse(response: Response): Promise<boolean> {
  if (response.status !== 403) return false;
  try {
    return reportAccountAccessBody(403, await response.clone().json());
  } catch {
    return false;
  }
}

/**
 * Le 403 d'une requête quelconque, lu UNE fois (sur une copie) : un compte bloqué
 * est déposé ; une connexion refusée (désactivé, bloqué, hors plage, trop de
 * sessions) est rendue à l'appelant, qui la dit en mots.
 */
export async function inspectForbidden(response: Response): Promise<AccountConnectRefusalBody | undefined> {
  if (response.status !== 403) return undefined;
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return undefined;
  }
  reportAccountAccessBody(403, body);
  return accountConnectRefusalOf(body) ?? undefined;
}

/** Un message du socket : l'annonce `account:access`, ou le refus d'authentification qui porte l'état. */
export function reportAccountAccessMessage(message: { type?: unknown; reason?: unknown } & Record<string, unknown>): boolean {
  if (message.type === "account:access") {
    const { type: _type, ...state } = message;
    if (state.state === "allowed") reportAccountAccess({ state: "allowed" });
    else if (isBlockedAccountAccess(state)) reportAccountAccess(state);
    else return false;
    return true;
  }
  if (message.type === "auth_error" && message.reason === ACCOUNT_ACCESS_AUTH_ERROR) {
    const { type: _type, reason: _reason, ...state } = message;
    if (!isBlockedAccountAccess(state)) return false;
    reportAccountAccess(state);
    return true;
  }
  return false;
}

export function readAccountAccess(): AccountAccessPage | null {
  return current;
}

export function subscribeAccountAccess(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
