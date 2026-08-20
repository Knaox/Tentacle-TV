import { createContext, useContext, useState, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * L'item qui éclaire le fond ambiant.
 *
 * # Deux contextes et non un, et c'est tout le sujet
 *
 * Un contexte re-rend TOUS ses consommateurs dès que sa valeur change, qu'ils
 * lisent la partie qui a bougé ou non. Avec un seul contexte portant à la fois
 * l'item et son poseur, `HomeScreen` — qui ne veut que le poseur — se re-rendait
 * à chaque déplacement de la télécommande : la bannière, chaque rangée, chaque
 * carte montée. Une centaine de cellules par rangée, pour une valeur qu'il ne
 * lisait même pas.
 *
 * Séparés, le poseur est stable pour la vie de l'écran (aucun re-rendu) et
 * l'item ne réveille que `TVAmbientBackdrop`, seul à en avoir besoin.
 *
 * C'est le motif recommandé de React pour un contexte dont une moitié change
 * souvent et l'autre jamais.
 */

/** Ce qui CHANGE — lu par le seul fond ambiant. */
const ItemAmbiantContext = createContext<MediaItem | null>(null);

type PoseurAmbiant = (item: MediaItem | null) => void;

const NE_RIEN_FAIRE: PoseurAmbiant = () => {};

/** Ce qui NE CHANGE PAS — appelé par les écrans et les cartes. */
const PoseurAmbiantContext = createContext<PoseurAmbiant>(NE_RIEN_FAIRE);

interface AmbientFocusProviderProps {
  children: ReactNode;
  /** Debounce delay in ms before commiting a focus change to the backdrop. */
  debounceMs?: number;
}

/** Chaque changement retenu coûte un décodage d'image PLEIN ÉCRAN : on attend
 *  que la télécommande se pose avant d'en demander un. */
const DEFAULT_DEBOUNCE = 150;

/**
 * Provides the focused item to the TVAmbientBackdrop.
 * Lives at the screen level (HomeScreen) — not global — because only Home
 * uses the ambient swap pattern. MediaDetail/Library have their own backdrops.
 */
export function AmbientFocusProvider({
  children,
  debounceMs = DEFAULT_DEBOUNCE,
}: AmbientFocusProviderProps) {
  const [focusedItem, setFocusedItemState] = useState<MediaItem | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFocusedItem = useCallback<PoseurAmbiant>(
    (item) => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      // Clear instantly — never debounce the "go to nothing" transition.
      if (item == null) {
        setFocusedItemState(null);
        return;
      }
      pendingTimer.current = setTimeout(() => {
        setFocusedItemState(item);
      }, debounceMs);
    },
    [debounceMs],
  );

  return (
    <PoseurAmbiantContext.Provider value={setFocusedItem}>
      <ItemAmbiantContext.Provider value={focusedItem}>{children}</ItemAmbiantContext.Provider>
    </PoseurAmbiantContext.Provider>
  );
}

/**
 * L'item courant — pour la seule couche qui le DESSINE.
 *
 * S'abonner ici, c'est se re-rendre à chaque déplacement de la télécommande :
 * ne l'appeler que si l'on affiche vraiment quelque chose de cet item.
 */
export function useItemAmbiant(): MediaItem | null {
  return useContext(ItemAmbiantContext);
}

/**
 * Le poseur — pour les écrans et les cartes.
 *
 * Stable : hors d'un fournisseur, il ne fait rien, et les composants de carte
 * n'ont donc pas à savoir si la couche ambiante est montée.
 */
export function usePoseurAmbiant(): PoseurAmbiant {
  return useContext(PoseurAmbiantContext);
}
