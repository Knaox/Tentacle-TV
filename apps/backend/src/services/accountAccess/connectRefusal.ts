/**
 * Une NOUVELLE connexion d'un compte (docs/DROITS-UTILISATEURS.md § 9.1) :
 * refusée en mots clairs, jamais par une erreur brute.
 *
 * - Par mot de passe, c'est Jellyfin qui juge (`AuthenticateByName`) et répond
 *   403 « Error processing request. » sans dire pourquoi — désactivé, hors
 *   plage, trop de sessions : la politique RELUE après l'échec le dit
 *   (`loginRefusal`).
 * - Sans mot de passe (jumelage d'une TV, code de connexion, profil de la
 *   Famille), Tentacle applique LUI-MÊME la règle de Jellyfin (`connectRefusal`).
 *
 * Sessions simultanées, mesuré sur Jellyfin 10.11.11
 * (`SessionManager.AuthenticateNewSessionInternal`) : une nouvelle connexion est
 * refusée quand le compte a DÉJÀ `MaxActiveSessions` sessions — TOUTES celles
 * que Jellyfin tient en mémoire pour lui (`GET /Sessions`, clé d'API), même
 * appareil compris ; celles en cours ne sont jamais coupées. Jellyfin muet :
 * rien à compter, la connexion passe (il jugera lui-même ses propres jetons).
 */

import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { isWithinSchedules, reachedLoginAttempts } from "../../accountAccess/accountAccessRule";
import type { AccountConnectRefusal, AccountConnectRefusalBody } from "../../accountAccess/accountAccessContract";
import type { AccessScheduleDto } from "../../userRights/userRightsContract";

interface JellyfinUserDto {
  Id?: string;
  Name?: string;
  Policy?: Record<string, unknown>;
}

const keyOf = (id: string) => id.replace(/-/g, "").toLowerCase();

const MESSAGES: Record<Exclude<AccountConnectRefusal, "account_max_sessions">, string> = {
  account_disabled: "Ce compte a été désactivé par l'administrateur du serveur.",
  account_locked_out: "Ce compte est bloqué après trop d'essais. Contactez l'administrateur.",
  account_outside_schedule: "Ce compte ne peut pas se connecter à cette heure-ci (plages horaires fixées par l'administrateur).",
};

function refusal(code: Exclude<AccountConnectRefusal, "account_max_sessions">): AccountConnectRefusalBody {
  return { message: MESSAGES[code], code };
}

/** « Ce compte est déjà connecté sur N appareils » — le maximum fixé par l'administrateur. */
export function maxSessionsRefusal(maxSessions: number): AccountConnectRefusalBody {
  const devices = maxSessions > 1 ? `${maxSessions} appareils` : "1 appareil";
  return {
    message: `Ce compte est déjà connecté sur ${devices}, le maximum autorisé par l'administrateur.`,
    code: "account_max_sessions",
    maxSessions,
  };
}

function schedulesOf(policy: Record<string, unknown>): AccessScheduleDto[] {
  if (!Array.isArray(policy.AccessSchedules)) return [];
  return (policy.AccessSchedules as Record<string, unknown>[]).flatMap((entry) =>
    typeof entry.DayOfWeek === "string" && typeof entry.StartHour === "number" && typeof entry.EndHour === "number"
      ? [{ dayOfWeek: entry.DayOfWeek as AccessScheduleDto["dayOfWeek"], startHour: entry.StartHour, endHour: entry.EndHour }]
      : [],
  );
}

/** Les sessions que Jellyfin compte pour ce compte — null s'il ne répond pas. */
export async function jellyfinSessionCount(userId: string): Promise<number | null> {
  const sessions = await jellyfinAdminFetch<{ UserId?: string }[]>("/Sessions");
  if (!sessions.ok || !Array.isArray(sessions.data)) return null;
  const key = keyOf(userId);
  return sessions.data.filter((session) => typeof session.UserId === "string" && keyOf(session.UserId) === key).length;
}

/**
 * La règle de Jellyfin sur une politique lue À L'INSTANT : désactivé, hors plage,
 * saturé. `sessionsOnly` : seulement le nombre de sessions — un profil de la
 * Famille désactivé ou hors plage s'ouvre, et sa page le dit (« Changer de profil »).
 */
async function refusalFor(user: JellyfinUserDto, now: number, sessionsOnly = false): Promise<AccountConnectRefusalBody | null> {
  const policy = user.Policy;
  if (!policy || typeof user.Id !== "string") return null;
  if (sessionsOnly) return sessionLimit(user.Id, policy);
  if (policy.IsDisabled === true) {
    const lockedOut = reachedLoginAttempts({
      invalidLoginAttemptCount: typeof policy.InvalidLoginAttemptCount === "number" ? policy.InvalidLoginAttemptCount : undefined,
      loginAttemptsBeforeLockout: typeof policy.LoginAttemptsBeforeLockout === "number" ? policy.LoginAttemptsBeforeLockout : undefined,
    });
    return refusal(lockedOut ? "account_locked_out" : "account_disabled");
  }
  if (!isWithinSchedules(schedulesOf(policy), now)) return refusal("account_outside_schedule");
  return sessionLimit(user.Id, policy);
}

async function sessionLimit(userId: string, policy: Record<string, unknown>): Promise<AccountConnectRefusalBody | null> {
  const max = typeof policy.MaxActiveSessions === "number" ? policy.MaxActiveSessions : 0;
  if (max < 1) return null;
  const count = await jellyfinSessionCount(userId);
  return count !== null && count >= max ? maxSessionsRefusal(max) : null;
}

/** Une connexion SANS mot de passe pour ce compte (jumelage, code, profil) : refusée ? */
export async function connectRefusal(
  userId: string,
  options: { sessionsOnly?: boolean; now?: number } = {},
): Promise<AccountConnectRefusalBody | null> {
  if (!/^[0-9a-fA-F-]{32,36}$/.test(userId)) return null;
  const user = await jellyfinAdminFetch<JellyfinUserDto>(`/Users/${encodeURIComponent(userId)}`);
  return user.ok && user.data ? refusalFor(user.data, options.now ?? Date.now(), options.sessionsOnly) : null;
}

/** Jellyfin vient de refuser (403) la connexion de ce nom : pourquoi ? null si rien ne l'explique. */
export async function loginRefusal(username: string, now = Date.now()): Promise<AccountConnectRefusalBody | null> {
  const users = await jellyfinAdminFetch<JellyfinUserDto[]>("/Users");
  if (!users.ok || !Array.isArray(users.data)) return null;
  const wanted = username.trim().toLowerCase();
  const user = users.data.find((entry) => typeof entry.Name === "string" && entry.Name.toLowerCase() === wanted);
  return user ? refusalFor(user, now) : null;
}
