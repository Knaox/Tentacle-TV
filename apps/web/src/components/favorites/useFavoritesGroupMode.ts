import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { isFavoritesGroupMode, type FavoritesGroupMode } from "@tentacle-tv/api-client";

/** Clé de stockage : le dernier regroupement choisi, pour ce navigateur seulement. */
const STORAGE_KEY = "tentacle_favorites_group";

function readStored(): FavoritesGroupMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isFavoritesGroupMode(value) ? value : "none";
  } catch {
    return "none";
  }
}

/**
 * Le regroupement de Mes favoris.
 *
 * Il vit dans l'ADRESSE (`?group=genre`), comme le reste des filtres de la
 * page (`useLibraryFilters`) : revenir d'une fiche retrouve les sections, et
 * l'adresse se partage. Sans paramètre, c'est le dernier choix de ce
 * navigateur qui s'applique — un regroupement est une habitude de lecture,
 * pas un filtre qu'on lève.
 */
export function useFavoritesGroupMode() {
  const [searchParams, setSearchParams] = useSearchParams();
  const fromUrl = searchParams.get("group");
  const mode: FavoritesGroupMode = isFavoritesGroupMode(fromUrl) ? fromUrl : readStored();

  const setMode = useCallback(
    (next: FavoritesGroupMode) => {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Stockage indisponible (navigation privée) : l'adresse suffit.
      }
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === "none") p.delete("group");
          else p.set("group", next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { mode, setMode };
}
