import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { TVFocusGuideView, type View } from "react-native";
import { groupEntryKey } from "@tentacle-tv/tv-core";
import type { FocusGroupContainerProps } from "../../../redesign/focus/focusBinding";
import type { FocusStore } from "./focusStore";
import { guideFocusable } from "./guideFocusable";

/**
 * Le guide d'ENTRÉE d'un groupe (`FocusGroup`) : quand le focus y arrive
 * d'ailleurs, il atterrit sur la dernière clé du groupe qui l'a eu — ou,
 * `remember` coupé ou rien encore visité, sur l'entrée par défaut
 * (`fallback` : l'onglet de la saison affichée, l'épisode à reprendre, la
 * première carte, Lecture). La décision est la règle de tv-core
 * (`focus/groupEntry.ts`) ; le guide la pose comme destination.
 *
 * Sans lui, tvOS vise l'élément situé sous le point de départ : l'épisode sous
 * l'onglet choisi plutôt que celui à reprendre, l'onglet sous Lecture plutôt
 * que la saison affichée — et rien du tout quand aucun élément du groupe ne
 * chevauche le point de départ (HAUT depuis la droite de l'écran).
 *
 * Le composant est créé UNE fois par groupe (le port l'exige stable) ; ce qui
 * varie se lit au moment voulu : `fallback` est rappelé, les nœuds viennent du
 * magasin. La cible est recalculée après chaque rendu (les nœuds s'attachent
 * au montage) et à chaque focus pris dans le groupe.
 *
 * `destinations` est TOUJOURS un tableau : sans lui, tvOS tient le guide pour
 * non sélectionnable et coupe l'accès à tout son contenu (cf. `RowEntryGuide`).
 * Et un guide sans destination se DÉCLARE non focalisable : react-native-tvos
 * marque sélectionnable tout guide dont `destinations` est un tableau, même
 * vide, et le guide retombé en simple vue devenait une cible invisible (le
 * pont du lecteur l'a payé : `BridgeGuide`) — sur Apple TV seulement : sur
 * Android TV, ce `false` bloquerait tout le groupe (`guideFocusable`).
 */

export interface EntryGuideOptions {
  /** Les clés dont le groupe se souvient (`episode:<i>`…). */
  owns: (focusKey: string) => boolean;
  /** L'entrée par défaut, lue à chaque visée. */
  fallback: () => string | null;
  /** Revenir au dernier élément visité (défaut : oui). */
  remember?: boolean;
  /** Retenir le focus aux bouts de la rangée : rien à atteindre de côté. */
  trapLeft?: boolean;
  trapRight?: boolean;
}

const NONE: View[] = [];

export function createEntryGuide(store: FocusStore, options: EntryGuideOptions): ComponentType<FocusGroupContainerProps> {
  const { owns, fallback, remember = true, trapLeft = false, trapRight = false } = options;

  return function EntryGuide({ style, pointerEvents, children }: FocusGroupContainerProps) {
    const [target, setTarget] = useState<View[]>(NONE);
    const last = useRef<string | null>(null);

    const aim = useCallback(() => {
      const key = groupEntryKey({ remember, last: last.current, isMounted: (focusKey) => store.node(focusKey) !== null, fallback });
      const node = key ? store.node(key) : null;
      setTarget((prev) => (node ? (prev[0] === node ? prev : [node]) : NONE));
    }, []);

    useEffect(
      () =>
        store.subscribe((key, focused) => {
          if (!focused || !owns(key)) return;
          last.current = key;
          aim();
        }),
      [aim],
    );
    // Après chaque rendu : une cible montée entre-temps, une entrée qui a changé.
    useEffect(aim);

    return (
      <TVFocusGuideView
        style={style}
        pointerEvents={pointerEvents}
        destinations={target}
        focusable={guideFocusable(target.length > 0)}
        trapFocusLeft={trapLeft}
        trapFocusRight={trapRight}
      >
        {children}
      </TVFocusGuideView>
    );
  };
}
