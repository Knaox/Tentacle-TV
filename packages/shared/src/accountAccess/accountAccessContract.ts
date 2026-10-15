import type { AccessScheduleDto } from "../userRights/userRightsContract";

/**
 * L'ACCÈS d'un compte à Tentacle — le CONTRAT entre le serveur et les clients
 * (docs/DROITS-UTILISATEURS.md § 9.1). Jellyfin fait foi : `IsDisabled` et
 * `AccessSchedules` de la politique du compte, relus par le serveur, jugés à
 * l'heure LOCALE du serveur Tentacle (`accountAccessRule.ts`).
 *
 * Recopié octet pour octet dans `apps/backend/src/accountAccess/` (test miroir) :
 * on modifie ICI, on recopie là-bas. Les noms traversent le réseau : ils ne se
 * renomment jamais une fois livrés.
 */

/** Le compte peut se servir de Tentacle. */
export interface AccountAccessAllowed {
  state: "allowed";
}

/** Le compte est désactivé dans Jellyfin. */
export interface AccountAccessDisabled {
  state: "disabled";
  /** Vrai : désactivé par Jellyfin (ou Tentacle pour lui) après trop de mots de passe faux. */
  lockedOut?: boolean;
}

/** Le compte est hors de ses plages horaires. */
export interface AccountAccessOutsideSchedule {
  state: "outsideSchedule";
  /**
   * Les plages PERMISES du compte, en heures LOCALES du serveur. Vide : inconnues
   * — un jeton Jellyfin dont le serveur ne sait plus à quel compte il appartient
   * (redémarré pendant la fermeture) : Jellyfin le refuse, sans dire qui il est.
   */
  schedules: AccessScheduleDto[];
  /** La prochaine ouverture (ms depuis l'époque) ; null : jamais, ou inconnue (`schedules` vide). */
  nextOpening: number | null;
}

export type AccountAccessBlocked = AccountAccessDisabled | AccountAccessOutsideSchedule;
export type AccountAccessState = AccountAccessAllowed | AccountAccessBlocked;
export type AccountAccessStateKind = AccountAccessState["state"];

/** La route lue par les clients : l'état du compte de la session (jamais refusée par la garde d'accès). */
export const ACCOUNT_ACCESS_ROUTE = "/api/account/access";

/** Le code d'erreur d'une porte qui refuse un compte bloqué. */
export const ACCOUNT_ACCESS_ERROR = "account_access";

/** Le corps d'un refus (403) : le code, et l'état qui le justifie. */
export type AccountAccessRefusalBody = { error: typeof ACCOUNT_ACCESS_ERROR } & AccountAccessBlocked;

/** L'annonce du canal de session, au moment où l'état CHANGE (puis fermeture si bloqué). */
export type AccountAccessWsMessage = { type: "account:access" } & AccountAccessState;

/** La raison d'un `auth_error` du socket pour un compte bloqué (le message porte l'état). */
export const ACCOUNT_ACCESS_AUTH_ERROR = "account_access";

/** Le code de fermeture du socket d'un compte qui vient d'être bloqué. */
export const ACCOUNT_ACCESS_CLOSE_CODE = 4012;

/**
 * Pourquoi une NOUVELLE connexion est refusée (connexion par mot de passe,
 * jumelage d'une TV, code de connexion, ouverture d'un profil de la Famille).
 * Réponse `{ message, code, maxSessions? }` : le client dit la raison en mots.
 */
export const ACCOUNT_CONNECT_REFUSALS = [
  "account_disabled",
  "account_locked_out",
  "account_outside_schedule",
  "account_max_sessions",
] as const;
export type AccountConnectRefusal = (typeof ACCOUNT_CONNECT_REFUSALS)[number];

export interface AccountConnectRefusalBody {
  message: string;
  code: AccountConnectRefusal;
  /** `account_max_sessions` : le maximum fixé par l'administrateur. */
  maxSessions?: number;
}

/** Statut HTTP d'une connexion refusée pour une de ces raisons (comme Jellyfin : 403). */
export const ACCOUNT_CONNECT_REFUSAL_STATUS = 403;

/** Vrai si `value` est un état d'accès BLOQUÉ bien formé (lu sur le réseau). */
export function isBlockedAccountAccess(value: unknown): value is AccountAccessBlocked {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.state === "disabled") return candidate.lockedOut === undefined || typeof candidate.lockedOut === "boolean";
  if (candidate.state !== "outsideSchedule") return false;
  return Array.isArray(candidate.schedules) && (candidate.nextOpening === null || typeof candidate.nextOpening === "number");
}

/** L'état bloqué que porte un corps de refus `{ error: "account_access", … }` — sinon null. */
export function accountAccessRefusalOf(body: unknown): AccountAccessBlocked | null {
  if (!body || typeof body !== "object") return null;
  if ((body as { error?: unknown }).error !== ACCOUNT_ACCESS_ERROR) return null;
  const { error: _error, ...rest } = body as Record<string, unknown>;
  return isBlockedAccountAccess(rest) ? (rest as unknown as AccountAccessBlocked) : null;
}

/** La raison d'une connexion refusée que porte un corps de réponse — sinon null. */
export function accountConnectRefusalOf(body: unknown): AccountConnectRefusalBody | null {
  if (!body || typeof body !== "object") return null;
  const { code, message, maxSessions } = body as Record<string, unknown>;
  if (typeof code !== "string" || !(ACCOUNT_CONNECT_REFUSALS as readonly string[]).includes(code)) return null;
  return {
    message: typeof message === "string" ? message : "",
    code: code as AccountConnectRefusal,
    ...(typeof maxSessions === "number" ? { maxSessions } : {}),
  };
}
