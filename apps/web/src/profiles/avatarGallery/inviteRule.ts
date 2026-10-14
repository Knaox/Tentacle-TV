/**
 * L'invitation unique du bureau : à la première ouverture d'une version qui a
 * la galerie, un compte SANS photo se voit proposer la troupe. Une fois par
 * compte et par appareil — que la personne choisisse, importe ou passe. Un
 * compte qui a déjà une photo n'est pas dérangé : l'écran des nouveautés lui
 * annonce la galerie, et le menu de l'avatar l'ouvre.
 */

/** Clé traversée par une chaîne : ne jamais la renommer. */
export const AVATAR_INVITE_SEEN_KEY = "tentacle_avatar_invite_seen";

/** Les comptes déjà invités sur cet appareil : on n'en garde qu'une poignée. */
const KEEP = 20;

export interface AvatarInviteContext {
  /** Bureau (ou sa préviz forcée en développement). */
  desktop: boolean;
  userId: string | null;
  /** Session personnelle : un profil de la Famille ne change pas la photo du compte. */
  personalSession: boolean;
  online: boolean;
  /** D'après Jellyfin ; `undefined` tant qu'il n'a pas répondu. */
  hasPhoto: boolean | undefined;
  /** Un autre recouvrement de démarrage est ouvert, ou l'on regarde quelque chose. */
  busy: boolean;
  invited: readonly string[];
}

export function shouldInviteToAvatars(context: AvatarInviteContext): boolean {
  return context.desktop
    && context.userId !== null
    && context.personalSession
    && context.online
    && context.hasPhoto === false
    && !context.busy
    && !context.invited.includes(context.userId);
}

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

export function readInvitedAccounts(storage: StorageLike | null = defaultStorage()): string[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(AVATAR_INVITE_SEEN_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Note le compte comme invité ; rend la liste à jour. */
export function markAccountInvited(userId: string, storage: StorageLike | null = defaultStorage()): string[] {
  const next = [userId, ...readInvitedAccounts(storage).filter((id) => id !== userId)].slice(0, KEEP);
  try {
    storage?.setItem(AVATAR_INVITE_SEEN_KEY, JSON.stringify(next));
  } catch {
    // Stockage refusé : l'invitation pourra revenir, sans casse.
  }
  return next;
}
