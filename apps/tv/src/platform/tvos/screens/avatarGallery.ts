import { useEffect, useState } from "react";
import {
  AVATAR_GALLERY_ACTIONS_GROUP,
  AVATAR_GALLERY_GRID_GROUP,
  AVATAR_GALLERY_LATER_KEY,
  avatarGalleryGuardedKeys,
  avatarIdOfKey,
  type AvatarGallerySection,
} from "@tentacle-tv/tv-core";
import { createEntryGuide } from "../focus/entryGuide";
import type { FocusStore } from "../focus/focusStore";

/**
 * L'applicateur de la GALERIE DES AVATARS (Apple TV ; Android TV par les
 * variantes `.android` du focus) — les décisions sont celles de tv-core
 * (`avatars/avatarGallery.ts`) ; ce module ne fait que les poser : la garde du
 * clic fantôme, les entrées des deux colonnes et l'entrée de la page.
 */

/**
 * Les liaisons naissent avec l'écran, avant son premier rendu. `entryKey` :
 * le personnage d'entrée, où revient la grille tant qu'aucun n'a été visité.
 */
export function useAvatarGalleryGroups(store: FocusStore, sections: readonly AvatarGallerySection[], entryKey: string): void {
  useState(() => {
    // La page paraît sous l'OK qui l'a ouverte : seul un OK commencé sur une de ses cibles y vaut.
    for (const key of avatarGalleryGuardedKeys(sections)) store.bind(key, { phantomPressGuard: true });
    // GAUCHE depuis n'importe quelle ligne de la grille : la colonne du panneau n'a qu'une cible,
    // « Plus tard » — sans guide, seule la ligne à sa hauteur l'atteignait.
    store.bind(AVATAR_GALLERY_ACTIONS_GROUP, {
      container: createEntryGuide(store, {
        owns: (key) => key === AVATAR_GALLERY_LATER_KEY,
        fallback: () => AVATAR_GALLERY_LATER_KEY,
        remember: false,
      }),
    });
    // DROITE depuis « Plus tard » : le dernier personnage visité, pas celui qui est à sa hauteur.
    store.bind(AVATAR_GALLERY_GRID_GROUP, {
      container: createEntryGuide(store, { owns: (key) => avatarIdOfKey(key) !== null, fallback: () => entryKey }),
    });
  });
}

/** L'entrée de la page, réclamée une fois montée. */
export function useAvatarGalleryEntry(store: FocusStore, entryKey: string | null): void {
  useEffect(() => (entryKey ? store.claim(entryKey) : undefined), [entryKey, store]);
}
