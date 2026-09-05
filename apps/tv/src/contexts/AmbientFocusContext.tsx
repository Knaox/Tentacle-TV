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

/**
 * Ce qui éclaire le fond : un MediaItem Jellyfin (son backdrop se résout dans
 * la couche), ou une image déjà ADRESSÉE — une recommandation n'est pas un
 * MediaItem, elle apporte son backdrop et son identité (`recoAmbientTarget`).
 */
export type AmbientTarget = MediaItem | { kind: "uri"; id: string; uri: string };

/** L'identité d'une cible — la clé d'une reco, l'Id d'un item Jellyfin. */
export function ambientTargetId(target: AmbientTarget): string {
  return "kind" in target ? target.id : target.Id;
}

/** Ce qui CHANGE — lu par le seul fond ambiant. */
const AmbientItemContext = createContext<AmbientTarget | null>(null);

type AmbientSetter = (item: AmbientTarget | null) => void;

const NO_OP: AmbientSetter = () => {};

/** Ce qui NE CHANGE PAS — appelé par les écrans et les cartes. */
const AmbientSetterContext = createContext<AmbientSetter>(NO_OP);

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
  const [focusedItem, setFocusedItemState] = useState<AmbientTarget | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFocusedItem = useCallback<AmbientSetter>(
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
    <AmbientSetterContext.Provider value={setFocusedItem}>
      <AmbientItemContext.Provider value={focusedItem}>{children}</AmbientItemContext.Provider>
    </AmbientSetterContext.Provider>
  );
}

/**
 * L'item courant — pour la seule couche qui le DESSINE.
 *
 * S'abonner ici, c'est se re-rendre à chaque déplacement de la télécommande :
 * ne l'appeler que si l'on affiche vraiment quelque chose de cet item.
 */
export function useAmbientItem(): AmbientTarget | null {
  return useContext(AmbientItemContext);
}

/**
 * Le poseur — pour les écrans et les cartes.
 *
 * Stable : hors d'un fournisseur, il ne fait rien, et les composants de carte
 * n'ont donc pas à savoir si la couche ambiante est montée.
 */
export function useAmbientSetter(): AmbientSetter {
  return useContext(AmbientSetterContext);
}
