import {
  AVATAR_INVITE_SEEN_KEY,
  honorPromptsReset,
  parseInvitedSubjects,
  withSubjectInvited,
  withoutSubjectInvited,
} from "@tentacle-tv/shared";

/**
 * Le stockage de l'invitation unique sur le web et le bureau (`localStorage`) ;
 * la règle elle-même est partagée avec le mobile (`shared` › `avatarInvite`).
 */

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readInvitedSubjects(storage: StorageLike | null = defaultStorage()): string[] {
  try {
    return parseInvitedSubjects(storage?.getItem(AVATAR_INVITE_SEEN_KEY));
  } catch {
    return [];
  }
}

/** Note le sujet (compte ou profil invité) comme invité ; rend la liste à jour. */
export function markSubjectInvited(subjectId: string, storage: StorageLike | null = defaultStorage()): string[] {
  const next = withSubjectInvited(readInvitedSubjects(storage), subjectId);
  try {
    storage?.setItem(AVATAR_INVITE_SEEN_KEY, JSON.stringify(next));
  } catch {
    // Stockage refusé : l'invitation pourra revenir, sans casse.
  }
  return next;
}

/**
 * « Reproposer le code PIN et la photo » (serveur 1.30.0) : une demande plus
 * récente que la dernière honorée sur cet ordinateur rend le sujet de nouveau
 * invitable — une fois (shared › `family/familyPromptsReset`). Le code PIN,
 * lui, est un rappel du COMPTE que le serveur a déjà réaffiché. Rend vrai si
 * l'invitation est de nouveau possible.
 */
export function honorDesktopPromptsReset(
  subjectId: string | null | undefined,
  resetAt: string | null | undefined,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  return honorPromptsReset(storage, subjectId, resetAt, (id) => {
    storage.setItem(AVATAR_INVITE_SEEN_KEY, JSON.stringify(withoutSubjectInvited(readInvitedSubjects(storage), id)));
  });
}
