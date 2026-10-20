import { accountAccessRefusalOf, accountConnectRefusalOf } from "../accountAccess/accountAccessContract";
import { rawFromError } from "./fromError";
import { classifyProblem } from "./classifyProblem";
import type { ProblemCause } from "./problemTypes";

/**
 * Les codes des domaines — ce que disent le serveur, Watch Together, le moteur
 * des titres hors ligne, la permission des notifications — traduits en UNE
 * cause du catalogue. Une plateforme ne recopie jamais ces tables : un code
 * qu'elle ne connaît pas encore devient la cause générique, jamais un code nu.
 */

/**
 * Watch Together : les `wt:error` de la socket, les raisons de `wt:dissolved`
 * et les refus REST (`{ code }`) de `/api/watch-together/*`. Les refus du jeu
 * d'Affinité (`need_two_members`, `empty_catalog`, `not_participant`,
 * `stale_session`, `answered` d'un lancement) sont dits par son propre écran.
 */
const WT_CAUSES: Record<string, ProblemCause> = {
  // Socket : `WtErrorCode`.
  not_in_group: "wtRoomClosed",
  not_host: "wtHostOnly",
  stale_item: "wtDesync",
  invalid: "unknown",
  // Socket : `WtDissolvedReason`.
  kicked: "wtRemoved",
  expired: "wtRoomClosed",
  dissolved: "wtRoomClosed",
  access_revoked: "wtAccessRevoked",
  // REST.
  access_denied: "wtAccessRevoked",
  already_in_group: "wtAlreadyInGroup",
  invite_gone: "wtInviteExpired",
  group_gone: "wtRoomClosed",
  not_member: "wtRoomClosed",
  unknown_title: "wtTitleUnavailable",
  // Adhésion par appareil (serveur 1.31.1) : rien à rejoindre ici.
  not_elsewhere: "wtRoomClosed",
};

export function wtProblemCause(code: string | null | undefined): ProblemCause {
  return (code && WT_CAUSES[code]) || "unknown";
}

/** Les `errorCode` du moteur hors ligne (`offline-core`, colonne `files.error_code`). */
const OFFLINE_CAUSES: Record<string, ProblemCause> = {
  "disk-full": "storageFull",
  unavailable: "transferSourceGone",
  missing: "offlineFileMissing",
  integrity: "offlineFileDamaged",
  io: "transferFailed",
  network: "transferFailed",
  finalize: "transferFailed",
  audio: "transferFailed",
  unexpected: "transferFailed",
};

/** La cause d'un transfert en échec ; `wait: "wifi"` : il n'échoue pas, il attend le Wi-Fi. */
export function offlineTransferCause(errorCode: string | null | undefined, wait?: "wifi" | "network" | null): ProblemCause {
  if (wait === "wifi") return "wifiRequired";
  if (wait === "network") return "deviceOffline";
  return (errorCode && OFFLINE_CAUSES[errorCode]) || "transferFailed";
}

/** La permission des notifications et l'inscription au service (Expo, APNs, FCM). */
export function pushProblemCause(status: "granted" | "denied" | "undetermined", registered: boolean): ProblemCause | null {
  if (status === "denied") return "pushDenied";
  if (status === "granted" && !registered) return "pushUnavailable";
  return null;
}

const ACCOUNT_CAUSES: Record<string, ProblemCause> = {
  account_disabled: "accountDisabled",
  account_locked_out: "accountLockedOut",
  account_outside_schedule: "accountOutsideSchedule",
  account_max_sessions: "accountMaxSessions",
};

/** Un compte bloqué EN COURS de session (`{ error: "account_access", state }`), sinon null. */
export function accountAccessCause(body: unknown): ProblemCause | null {
  const blocked = accountAccessRefusalOf(body);
  if (!blocked) return null;
  if (blocked.state === "outsideSchedule") return "accountOutsideSchedule";
  return blocked.lockedOut ? "accountLockedOut" : "accountDisabled";
}

const BAD_CREDENTIALS = /\b40[01]\b|identifiants invalides|invalid credentials|invalid username or password/i;
const TOO_MANY = /\b429\b|too many/i;

/**
 * L'échec d'une connexion au compte (identifiant + mot de passe, code de
 * connexion) — la même lecture que le web (`loginError.ts`) : le refus du
 * serveur d'abord (compte désactivé, bloqué, hors plage, trop d'appareils),
 * puis les identifiants, les essais, la migration de la base, et sinon la
 * cause du réseau ou du serveur.
 */
export function signInProblemCause(error: unknown): ProblemCause {
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const refusal = accountConnectRefusalOf(record.refusal ?? record.body ?? null);
  if (refusal) return ACCOUNT_CAUSES[refusal.code] ?? "notAllowed";
  if (typeof record.code === "string" && ACCOUNT_CAUSES[record.code]) return ACCOUNT_CAUSES[record.code];
  const raw = rawFromError(error, "relayed");
  if (raw.status === 503 && /migrating/i.test(raw.message ?? "")) return "databaseMigrating";
  if (raw.status === 429 || TOO_MANY.test(raw.message ?? "")) return "tooManyAttempts";
  if (raw.status === 401 || raw.status === 400 || BAD_CREDENTIALS.test(raw.message ?? "")) return "wrongCredentials";
  return classifyProblem(raw);
}
