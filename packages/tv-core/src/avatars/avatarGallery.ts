import { AVATAR_COLLECTIONS, avatarsOf, type AvatarCharacter, type AvatarCollection } from "@tentacle-tv/shared";

/**
 * La GALERIE DES AVATARS de la TV (Apple TV, Android TV) — l'écran où l'on
 * choisit sa photo de profil dans la troupe des personnages. Module pur : ce
 * que l'écran décide (sections, clés de focus, entrée, envoi, Retour) ;
 * l'adaptateur l'applique, l'intégration envoie l'image.
 *
 * - La grille suit le catalogue (shared `avatarCatalog`) : une section par
 *   collection, dans l'ordre de la galerie du bureau.
 * - OK sur un personnage le CHOISIT : son image part comme photo Jellyfin du
 *   sujet (`sending`), puis l'écran confirme un instant (`done`) et se ferme.
 *   Un échec rend la main sur la grille, le personnage marqué (`failedId`).
 * - Un seul envoi à la fois : un OK pendant l'envoi ne fait rien.
 * - Retour vaut « Plus tard » — sauf pendant l'envoi et la confirmation, où il
 *   est retenu : la photo part, l'écran se ferme de lui-même dans l'instant.
 * - L'entrée : le premier personnage, jamais « Plus tard ».
 */

/** Une section de la grille : une collection et ses personnages, dans l'ordre. */
export interface AvatarGallerySection {
  collection: AvatarCollection;
  characters: readonly AvatarCharacter[];
}

/** Les sections de la galerie, dans l'ordre du catalogue. */
export function avatarGallerySections(): AvatarGallerySection[] {
  return AVATAR_COLLECTIONS.map((collection) => ({ collection, characters: avatarsOf(collection) }));
}

/** Les colonnes de la grille : une collection (douze personnages) tient sur deux lignes. */
export const AVATAR_GALLERY_COLUMNS = 6;

const TILE_PREFIX = "avatarGallery:tile:";

/** La clé d'un personnage de la grille. */
export const avatarTileKey = (id: string): string => `${TILE_PREFIX}${id}`;

/** Le personnage d'une clé de la grille ; null hors de la grille. */
export function avatarIdOfKey(focusKey: string): string | null {
  return focusKey.startsWith(TILE_PREFIX) ? focusKey.slice(TILE_PREFIX.length) || null : null;
}

/** « Plus tard », au pied du panneau. */
export const AVATAR_GALLERY_LATER_KEY = "avatarGallery:later";
/** La grille (elle défile) et le pied du panneau. */
export const AVATAR_GALLERY_GRID_GROUP = "avatarGallery:grid";
export const AVATAR_GALLERY_ACTIONS_GROUP = "avatarGallery:actions";

/** Le focus d'entrée : le premier personnage — jamais « Plus tard ». */
export function avatarGalleryEntryKey(sections: readonly AvatarGallerySection[]): string {
  const first = sections.find((section) => section.characters.length > 0)?.characters[0];
  return first ? avatarTileKey(first.id) : AVATAR_GALLERY_LATER_KEY;
}

/** Ce qui ne vaut qu'un OK commencé dessus : la galerie paraît sous l'OK qui l'a ouverte. */
export function avatarGalleryGuardedKeys(sections: readonly AvatarGallerySection[]): string[] {
  const tiles = sections.flatMap((section) => section.characters.map((character) => avatarTileKey(character.id)));
  return [...tiles, AVATAR_GALLERY_LATER_KEY];
}

/** L'état de l'écran : on parcourt (après un échec éventuel), on envoie, c'est fait. */
export type AvatarGalleryPhase =
  | { kind: "browsing"; failedId: string | null }
  | { kind: "sending"; id: string }
  | { kind: "done"; id: string };

export const AVATAR_GALLERY_START: AvatarGalleryPhase = { kind: "browsing", failedId: null };

/** Le temps de la confirmation (« C'est fait ») avant que l'écran se ferme. */
export const AVATAR_GALLERY_DONE_MS = 900;

/** Un envoi part, ou un écran déjà occupé ignore l'OK. */
export function avatarGalleryBusy(phase: AvatarGalleryPhase): boolean {
  return phase.kind !== "browsing";
}

/** OK sur un personnage : l'envoi part — sauf si un autre est en cours ou fait. */
export function pickAvatar(phase: AvatarGalleryPhase, id: string): AvatarGalleryPhase {
  return avatarGalleryBusy(phase) ? phase : { kind: "sending", id };
}

/** L'envoi a répondu : c'est fait, ou la grille rend la main, le personnage marqué. */
export function avatarPickSettled(phase: AvatarGalleryPhase, sent: boolean): AvatarGalleryPhase {
  if (phase.kind !== "sending") return phase;
  return sent ? { kind: "done", id: phase.id } : { kind: "browsing", failedId: phase.id };
}

export type AvatarGalleryBackAction = "skip" | "hold";

/** Retour : « Plus tard » ; retenu pendant l'envoi et la confirmation. */
export function avatarGalleryBackAction(phase: AvatarGalleryPhase): AvatarGalleryBackAction {
  return avatarGalleryBusy(phase) ? "hold" : "skip";
}

/**
 * À qui la galerie donne une photo — le pendant de `useAvatarTarget` du web :
 * - `self` : le sujet de la session (profil ouvert, ou compte jumelé) — sa
 *   photo Jellyfin, posée par le proxy (`avatars.devicePhoto`) ;
 * - `guest` : un invité de la Famille, que le SERVEUR habille
 *   (`family.guestPhotos`) — la règle de qui peut l'habiller depuis une TV
 *   est celle du serveur.
 */
export type AvatarGalleryTarget =
  | { kind: "self" }
  | { kind: "guest"; userId: string; name: string };

export const SELF_AVATAR_TARGET: AvatarGalleryTarget = { kind: "self" };
