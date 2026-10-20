import { sameUserId } from "../family/familyRules";

/**
 * QUI l'invitation aux avatars (et l'étape « Votre photo » du premier
 * lancement) habillerait, et s'il a déjà une photo — pour une app qui ouvre
 * des SESSIONS DE PROFIL de la Famille (mobile). Module pur :
 * `avatarInviteSubject.test.ts`.
 *
 * - En session personnelle : le compte, sa photo d'après Jellyfin
 *   (`accountHasPhoto`, `undefined` tant que son profil n'a pas été relu).
 * - En session de profil : le PROFIL, sa photo d'après le SERVEUR — la liste
 *   de « Qui regarde ? » si elle a répondu (une photo posée ailleurs y est
 *   déjà), sinon la marque du profil (posée au choix, tenue à jour par la
 *   galerie). Jamais `accountHasPhoto` : le jeton d'une session de profil est
 *   un jeton d'appareil, et `/Users/Me` n'y répond pas (la clé prêtée par le
 *   proxy n'a pas de compte) — l'invitation attendait un constat qui ne
 *   venait jamais (retour de l'alpha, 21/10).
 * - Sa photo se change par l'appareil si le serveur le sait (`devicePhoto`,
 *   capacité `avatars.devicePhoto`) ; la session personnelle, toujours.
 */
export interface AvatarInviteSubjectInput {
  accountId: string | null;
  accountHasPhoto: boolean | undefined;
  /** Le profil de la session de profil en cours ; null en session personnelle. */
  profile: { id: string; imageTag: string | null } | null;
  /** Les profils lus chez le serveur (« Qui regarde ? »), s'il a répondu. */
  listed: readonly { userId: string; imageTag: string | null }[] | undefined;
  devicePhoto: boolean;
}

export interface AvatarInviteSubject {
  subjectId: string | null;
  hasPhoto: boolean | undefined;
  canChangePhoto: boolean;
}

export function avatarInviteSubject(input: AvatarInviteSubjectInput): AvatarInviteSubject {
  const { profile } = input;
  if (!profile) return { subjectId: input.accountId, hasPhoto: input.accountHasPhoto, canChangePhoto: true };
  const listed = input.listed?.find((candidate) => sameUserId(candidate.userId, profile.id));
  const imageTag = listed ? listed.imageTag : profile.imageTag;
  return { subjectId: profile.id, hasPhoto: imageTag !== null, canChangePhoto: input.devicePhoto };
}
