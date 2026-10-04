import { z } from "zod";
import { FAMILY_PROFILE_COLORS } from "../../family/familyContract";

/**
 * Les corps et paramètres des routes de la Famille, validés à l'entrée — la
 * forme seulement : le SENS (PIN de quatre chiffres, nom d'invité, droits de
 * l'appelant) est jugé par les règles (`family/familyRules.ts`) et les
 * services, pour rendre le bon code d'erreur. Les clés inconnues sont
 * ignorées (un client plus récent ne casse pas un serveur plus ancien).
 */

/** Un identifiant de compte Jellyfin (avec ou sans tirets). */
export const userIdSchema = z.string().min(1).max(80).regex(/^[A-Za-z0-9-]+$/);

/** Un identifiant d'invitation : 128 bits en base64url — dans le CORPS, jamais
 *  dans l'URL (le serveur journalise ses URL). */
export const invitationIdSchema = z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const invitationActionBodySchema = z.object({ id: invitationIdSchema });

/** Une famille (cuid). */
export const familyIdSchema = z.string().min(1).max(191).regex(/^[A-Za-z0-9_-]+$/);

/** `null` retire le PIN ; la forme (quatre chiffres) est jugée par `isValidPin`. */
export const setPinBodySchema = z.object({ pin: z.union([z.string().max(16), z.null()]) });

export const createGuestBodySchema = z.object({
  name: z.string().max(200),
  color: z.enum(FAMILY_PROFILE_COLORS),
});

export const inviteBodySchema = z.object({ userId: userIdSchema });

/** Les droits d'un membre : seuls les champs présents changent. */
export const setMemberRightsBodySchema = z.object({ createGuests: z.boolean().optional() });

export const dissolveBodySchema = z.object({ confirm: z.literal("dissolve") });

export const candidatesQuerySchema = z.object({ q: z.string().max(100).optional() });

export const openTvSessionBodySchema = z.object({
  profileId: userIdSchema,
  pin: z.string().max(16).optional(),
  remember: z.boolean().optional(),
});

export const manageUnlockBodySchema = z.object({ pin: z.string().max(16).optional() });

export const adminSwitchesBodySchema = z.object({
  families: z.boolean().optional(),
  guests: z.boolean().optional(),
});
