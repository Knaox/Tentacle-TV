/**
 * La Famille — ses LIMITES : les bornes et les délais que le serveur fait
 * respecter et que les clients montrent (places, invitations, invités, PIN et
 * ses blocages, déverrouillage de la gestion, sélecteur). Partie du contrat :
 * `familyContract.ts` les ré-exporte. Carnet complet : docs/FAMILLE.md.
 *
 * MIROIR : `apps/backend/src/family/familyLimits.ts` en porte la copie octet
 * pour octet (commande de recopie : l'en-tête de `familyContract.ts`).
 */

/** Profils d'une famille, propriétaire compris (invitations en attente comptées). */
export const FAMILY_MAX_PROFILES = 6;
/** Invités d'une famille, au plus — tous créateurs confondus. */
export const FAMILY_MAX_GUESTS = 3;
/** Une invitation vaut sept jours. */
export const FAMILY_INVITATION_TTL_MS = 7 * 24 * 3_600_000;
/** Après un refus, le même propriétaire ne réinvite pas ce compte avant sept jours. */
export const FAMILY_DECLINE_COOLDOWN_MS = 7 * 24 * 3_600_000;
/** Invitations envoyées par un propriétaire sur 24 heures glissantes. */
export const FAMILY_INVITES_PER_DAY = 10;
/** Invitations en attente pour un même destinataire, toutes familles confondues
 *  (en accepter une clôt les autres : une famille par compte). */
export const FAMILY_MAX_PENDING_PER_INVITEE = 10;
/** Invités créés dans une famille sur 24 heures glissantes, tous créateurs
 *  confondus (chacun est un compte Jellyfin : pas de création en rafale). */
export const FAMILY_GUESTS_PER_DAY = 6;
/** « Plus tard » : l'affiche ne revient pas avant ce délai (la cloche la garde). */
export const FAMILY_SNOOZE_MS = 24 * 3_600_000;
/** Le code PIN : exactement quatre chiffres. */
export const FAMILY_PIN_LENGTH = 4;
/** Essais ratés avant blocage, par profil — toutes TV confondues. */
export const FAMILY_PIN_MAX_FAILURES = 5;
/** Durées des blocages successifs (le dernier se répète) ; une réussite remet à zéro. */
export const FAMILY_PIN_LOCK_STEPS_MS = [15 * 60_000, 3_600_000, 4 * 3_600_000, 24 * 3_600_000] as const;
/** « Gérer les profils » sur la TV : ouvert par le PIN de qui gère (le
 *  propriétaire ou un membre, chacun avec SES droits), pour dix minutes. */
export const FAMILY_MANAGE_UNLOCK_MS = 10 * 60_000;
/** Le nom d'un invité, une fois nettoyé. */
export const FAMILY_GUEST_NAME_MAX = 20;
/** Le sélecteur « Qui regarde ? » de la TV s'affiche dès deux profils. */
export const FAMILY_PICKER_MIN_PROFILES = 2;
