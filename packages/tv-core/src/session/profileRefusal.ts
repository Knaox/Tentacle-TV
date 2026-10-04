import { familyErrorOf, isProfileEndedReply, type FamilyErrorCode } from "@tentacle-tv/shared";

/**
 * Ce que la TV FAIT d'un refus du serveur de la Famille — sur « Qui regarde ? »,
 * le pavé du PIN et « Gérer les profils ». Module pur : le serveur dit le code
 * (`familyProtocol.ts`), cette règle dit l'écran.
 *
 * Seul un jumelage RÉVOQUÉ déjumelle (`family.pairing_required` + `revoked`, ou
 * un 401 `revoked` sans `profileEnded`) ; une session de profil terminée
 * (`profileEnded`) ramène à « Qui regarde ? ». Un serveur muet, saturé ou
 * coupé ne conclut rien : on réessaie.
 */
export type ProfileRefusal =
  | { kind: "pinInvalid"; attemptsLeft: number }
  | { kind: "pinRequired" }
  | { kind: "locked"; until: string | null }
  /** Le profil n'est plus ouvrable ici (retiré, supprimé) : relire la liste. */
  | { kind: "unavailable" }
  /** L'administration a coupé les familles ou les invités : relire la liste. */
  | { kind: "disabled"; code: "family.disabled" | "family.guests_disabled" }
  /** Le jumelage n'existe plus : se déjumeler. */
  | { kind: "unpaired" }
  /** Un jeton d'avant les profils : l'échange d'abord. */
  | { kind: "enroll" }
  /** « Gérer les profils » s'est refermé (dix minutes) : le PIN du propriétaire, de nouveau. */
  | { kind: "manageLocked" }
  /** La session de profil qui portait l'appel a cessé : « Qui regarde ? ». */
  | { kind: "ended" }
  /** Un autre refus : le dire (`family:errors.<code>`), rien d'autre. */
  | { kind: "failed"; code: FamilyErrorCode | null }
  | { kind: "offline" };

/** `status` : le statut HTTP, 0 sans réponse ; `body` : le corps (objet, ou texte JSON). */
export function profileRefusalOf(status: number, body: unknown): ProfileRefusal {
  if (status === 0) return { kind: "offline" };
  const error = familyErrorOf(body);
  if (error) {
    switch (error.code) {
      case "family.pin_invalid":
        return { kind: "pinInvalid", attemptsLeft: Math.max(0, error.attemptsLeft ?? 0) };
      case "family.pin_required":
        return { kind: "pinRequired" };
      case "family.pin_locked":
        return { kind: "locked", until: error.lockedUntil ?? null };
      case "family.profile_unavailable":
      case "family.not_found":
        return { kind: "unavailable" };
      case "family.disabled":
      case "family.guests_disabled":
        return { kind: "disabled", code: error.code };
      case "family.pairing_required":
        return error.revoked ? { kind: "unpaired" } : { kind: "failed", code: error.code };
      case "family.enroll_required":
        return { kind: "enroll" };
      case "family.manage_locked":
        return { kind: "manageLocked" };
      case "family.jellyfin_unavailable":
        return { kind: "offline" };
      default:
        return { kind: "failed", code: error.code };
    }
  }
  if (isProfileEndedReply(body)) return { kind: "ended" };
  if (status === 401 && isRevokedReply(body)) return { kind: "unpaired" };
  if (status >= 500 || status === 429 || status === 408) return { kind: "offline" };
  return { kind: "failed", code: null };
}

function isRevokedReply(body: unknown): boolean {
  let parsed: unknown = body;
  if (typeof body === "string") {
    try {
      parsed = JSON.parse(body);
    } catch {
      return false;
    }
  }
  return !!parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).revoked === true;
}

/** Les refus qui obligent à relire « Qui regarde ? » (la liste a changé sous nos pieds). */
export function refusalReloadsProfiles(refusal: ProfileRefusal): boolean {
  return refusal.kind === "unavailable" || refusal.kind === "disabled" || refusal.kind === "pinRequired";
}
