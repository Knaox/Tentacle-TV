/**
 * L'invitation unique à choisir un avatar — la règle, pour le bureau comme
 * pour le mobile. Au premier lancement d'une version qui a la galerie (ou juste
 * après la première connexion), la galerie s'ouvre d'elle-même pour qui n'a
 * PAS de photo : le compte, ou le profil invité de la Famille dont la session
 * est ouverte sur cet appareil. Une fois par sujet et par appareil — choisir,
 * importer ou passer, c'est pareil. Qui a déjà une photo n'est pas dérangé :
 * l'écran des nouveautés lui annonce la galerie, et « Changer la photo » l'ouvre.
 *
 * Pure : chaque client lit et écrit la liste des invités dans SON stockage
 * (`localStorage` sur le web et le bureau, `AsyncStorage` sur le mobile), sous
 * la même clé.
 */

/** Clé traversée par une chaîne : ne jamais la renommer. */
export const AVATAR_INVITE_SEEN_KEY = "tentacle_avatar_invite_seen";

/** Les sujets déjà invités sur cet appareil : on n'en garde qu'une poignée. */
const KEEP = 20;

export interface AvatarInviteContext {
  /** La plateforme invite (bureau, mobile — ou leur préviz de développement). */
  eligible: boolean;
  /** Le compte, ou le profil invité de la session en cours : celui dont la photo changerait. */
  subjectId: string | null;
  /** Cette session peut changer cette photo (session personnelle, ou invité que l'appareil peut habiller). */
  canChangePhoto: boolean;
  online: boolean;
  /** D'après Jellyfin ; `undefined` tant qu'il n'a pas répondu. */
  hasPhoto: boolean | undefined;
  /** Un autre recouvrement de démarrage est ouvert (ou n'a pas tranché), ou l'on regarde quelque chose. */
  busy: boolean;
  invited: readonly string[];
}

export function shouldInviteToAvatars(context: AvatarInviteContext): boolean {
  return context.eligible
    && context.subjectId !== null
    && context.canChangePhoto
    && context.online
    && context.hasPhoto === false
    && !context.busy
    && !context.invited.includes(context.subjectId);
}

/** La liste lue dans le stockage ; une valeur absente ou abîmée vaut « personne ». */
export function parseInvitedSubjects(raw: string | null | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** La liste après l'invitation de `subjectId` : le plus récent en tête, sans doublon. */
export function withSubjectInvited(invited: readonly string[], subjectId: string): string[] {
  return [subjectId, ...invited.filter((id) => id !== subjectId)].slice(0, KEEP);
}

/** La liste sans `subjectId` : la galerie pourra lui être proposée de nouveau
 *  (« Reproposer le code PIN et la photo », `family/familyPromptsReset`). */
export function withoutSubjectInvited(invited: readonly string[], subjectId: string): string[] {
  return invited.filter((id) => id !== subjectId);
}
