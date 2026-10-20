import {
  AVATAR_INVITE_SEEN_KEY, MOBILE_AVATAR_INVITE_ROUND, honorAvatarInviteRound, parseInvitedSubjects, withSubjectInvited,
} from "@tentacle-tv/shared";

/**
 * Ce que le mobile ajoute à la règle partagée de l'invitation aux avatars
 * (`shared` › `avatarInvite`) : QUAND il est occupé, et où il range les
 * comptes déjà invités. Module PUR : testé sous vitest.
 */

export interface InviteBusyContext {
  /** Tous les recouvrements du démarrage ont tranché et se sont tus (`startup/startupOverlays`). */
  overlaysQuiet: boolean;
  /** Le chemin courant d'expo-router (`/watch/…` : le lecteur). */
  pathname: string;
  /** Le premier segment de la route (`(auth)` : connexion, choix du serveur). */
  rootSegment: string | undefined;
  /** L'application est au premier plan — pas derrière une fenêtre du système. */
  appActive: boolean;
  /** La galerie de l'invitation est déjà ouverte. */
  galleryOpen: boolean;
}

/** Le mobile est-il occupé ? Jamais par-dessus un recouvrement, le lecteur, la connexion ou le système. */
export function inviteBusy(context: InviteBusyContext): boolean {
  return !context.overlaysQuiet
    || context.pathname.startsWith("/watch")
    || context.rootSegment === "watch"
    || context.rootSegment === "(auth)"
    || !context.appActive
    || context.galleryOpen;
}

interface InviteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Les sujets déjà invités sur cet appareil (AsyncStorage, préchargé) — après
 * le passage au tour du mobile (`honorAvatarInviteRound`) : un appareil qui
 * avait vu l'ancienne invitation sans choisir la reçoit une fois de plus.
 */
export function readInvitedSubjects(storage: InviteStorage): string[] {
  try {
    honorAvatarInviteRound(storage, MOBILE_AVATAR_INVITE_ROUND);
    return parseInvitedSubjects(storage.getItem(AVATAR_INVITE_SEEN_KEY));
  } catch {
    return [];
  }
}

/** Note le compte comme invité — fermer, choisir ou importer, c'est pareil ; rend la liste à jour. */
export function markSubjectInvited(storage: InviteStorage, subjectId: string): string[] {
  const next = withSubjectInvited(readInvitedSubjects(storage), subjectId);
  try {
    storage.setItem(AVATAR_INVITE_SEEN_KEY, JSON.stringify(next));
  } catch {
    // Stockage refusé : l'invitation pourra revenir, sans casse.
  }
  return next;
}
