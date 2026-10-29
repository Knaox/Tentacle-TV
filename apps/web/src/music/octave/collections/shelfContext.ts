/**
 * Octave — la RUBRIQUE de la bibliothèque où une carte est montrée (albums, artistes, playlists) : son ordre, et
 * « Réordonner ». Posée par la bibliothèque autour de ses grilles ; ailleurs (accueil, recherche, artiste), aucune :
 * le menu d'une carte n'y offre que le favori et la gestion.
 */

import { createContext, useContext } from "react";
import type { LibraryShelf } from "@tentacle-tv/api-client";
import type { MusicShelfSection } from "@tentacle-tv/shared/music";

export interface ShelfScope {
  section: MusicShelfSection;
  shelf: Pick<LibraryShelf<unknown>, "ordered" | "atTop" | "canReorder" | "moveToTop">;
  /** Ouvre la fenêtre « Réordonner » sur la section de cet élément. */
  reorder: (key: string) => void;
}

export const ShelfScopeContext = createContext<ShelfScope | null>(null);

/** La rubrique de la carte, si elle est celle de `section`. */
export function useShelfScope(section: MusicShelfSection): ShelfScope | null {
  const scope = useContext(ShelfScopeContext);
  return scope?.section === section ? scope : null;
}
