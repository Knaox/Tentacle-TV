import { avatarsOf, type AvatarCharacter } from "@tentacle-tv/shared";

/**
 * Les personnages que la scène de la galerie montre : la première rangée des
 * abysses, telle que la galerie l'ouvre. Leurs vraies vignettes (192 px),
 * servies par le client lui-même (`public/avatars/thumbs/`) — même chemin que
 * `profiles/avatarGallery/avatarImages.ts`, que l'écran des nouveautés
 * n'importe pas : le client LG ne compile pas `profiles/`.
 */
export const SCENE_CAST: readonly AvatarCharacter[] = avatarsOf("abyss").slice(0, 6);

/** Celui que la scène choisit : Huit, ses huit bras pris par la soirée. */
export const SCENE_CHOSEN = Math.max(0, SCENE_CAST.findIndex((avatar) => avatar.id === "huit"));

export function sceneThumbUrl(id: string): string {
  return `/avatars/thumbs/${id}.webp`;
}
