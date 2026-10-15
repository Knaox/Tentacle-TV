/**
 * La Famille — les CORPS des requêtes. Partie du contrat : `familyContract.ts`
 * le ré-exporte. MIROIR : `apps/backend/src/family/familyBodies.ts`, octet pour
 * octet (commande de recopie : l'en-tête de `familyContract.ts`).
 */

import type { FamilyGuestPhotoType } from "./familyLimits";
import type { FamilyGuestRights, FamilyMemberRights, FamilyProfileColor } from "./familyContract";

export interface CreateGuestBody {
  name: string;
  color: FamilyProfileColor;
}

/** `null` retire le PIN. Poser, changer ou retirer un PIN coupe le profil sur les TV. */
export interface SetPinBody {
  pin: string | null;
}

/** Son PIN, par soi-même (`setOwnPin`) : depuis une session personnelle, ou
 *  depuis SA session de profil sur une TV — l'acteur est toujours la session,
 *  jamais un identifiant du corps. */
export interface SetOwnPinBody extends SetPinBody {
  /** Le PIN actuel : EXIGÉ dès que le compte en a un, sur toute session.
   *  Vérifié comme à l'ouverture d'un profil — même compteur par profil, même
   *  blocage : `family.pin_required`, `family.pin_invalid` (`attemptsLeft`),
   *  `family.pin_locked` (`lockedUntil`). Ignoré sans PIN posé. */
  currentPin?: string;
}

/** La photo d'un invité (`setGuestPhoto`) : l'image en base64 nu, comme
 *  Jellyfin la reçoit — un personnage de la galerie ou une photo importée. */
export interface SetGuestPhotoBody {
  image: string;
  type: FamilyGuestPhotoType;
}

/** → sa nouvelle étiquette (`PrimaryImageTag`) ; null si Jellyfin ne la dit pas encore. */
export interface GuestPhotoDto {
  imageTag: string | null;
}

export interface InviteBody {
  userId: string;
}

/** Le propriétaire règle les droits d'un membre : seuls les champs présents changent. */
export type SetMemberRightsBody = Partial<FamilyMemberRights>;

/** Le propriétaire règle les droits d'un invité : seuls les champs présents changent. */
export type SetGuestRightsBody = Partial<FamilyGuestRights>;

/** La dissolution exige ce mot, en toutes lettres. */
export interface DissolveBody {
  confirm: "dissolve";
}

/** Un geste sur une invitation : son identifiant voyage dans le CORPS, jamais
 *  dans l'URL (le serveur journalise ses URL). */
export interface InvitationActionBody {
  id: string;
}
