import {
  FAMILY_ERROR_STATUS,
  FAMILY_NOTIFICATION_TYPES,
  type FamilyErrorBody,
  type FamilyErrorCode,
  type FamilyNotificationType,
} from "./familyProtocol";

/**
 * La Famille côté CLIENTS (web, bureau, mobile, Apple TV) : lire un refus du
 * serveur et le dire avec les mots de l'espace i18n `family`. Pas de miroir :
 * le serveur n'a pas besoin de ce fichier.
 */

export function isFamilyErrorCode(value: unknown): value is FamilyErrorCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(FAMILY_ERROR_STATUS, value);
}

/**
 * Le refus de la Famille contenu dans une réponse — l'objet lui-même, ou le
 * TEXTE brut d'un corps JSON (ce que garde `TentacleApiError.message`). null
 * pour tout autre échec : réseau coupé, serveur d'avant la Famille, autre route.
 */
export function familyErrorOf(source: unknown): FamilyErrorBody | null {
  let body: unknown = source;
  if (typeof source === "string") {
    try {
      body = JSON.parse(source);
    } catch {
      return null;
    }
  }
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (!isFamilyErrorCode(record.code)) return null;
  return {
    code: record.code,
    message: typeof record.message === "string" ? record.message : "",
    ...(typeof record.attemptsLeft === "number" && { attemptsLeft: record.attemptsLeft }),
    ...(typeof record.lockedUntil === "string" && { lockedUntil: record.lockedUntil }),
    ...(typeof record.retryAt === "string" && { retryAt: record.retryAt }),
    ...(typeof record.status === "string" && { status: record.status as FamilyErrorBody["status"] }),
    ...(record.revoked === true && { revoked: true as const }),
  };
}

/** Un 401 qui met fin à une session de profil de TV (et pas au jumelage). */
export function isProfileEndedReply(source: unknown): boolean {
  let body: unknown = source;
  if (typeof source === "string") {
    try {
      body = JSON.parse(source);
    } catch {
      return false;
    }
  }
  return !!body && typeof body === "object" && (body as Record<string, unknown>).profileEnded === true;
}

/** La clé i18n d'un refus : `family:errors.pin_invalid` pour `family.pin_invalid`. */
export function familyErrorKey(code: FamilyErrorCode): string {
  return `family:errors.${code.slice("family.".length)}`;
}

export function isFamilyNotificationType(type: string): type is FamilyNotificationType {
  return (FAMILY_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

/** La clé i18n du titre d'une notification de la Famille (interpolation `{{name}}`). */
export function familyNotificationKey(type: FamilyNotificationType): string {
  return `family:notifications.${type}`;
}
