import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { TVFocusGuideView, type View } from "react-native";
import type { FocusGroupContainerProps } from "../../redesign/focus/focusBinding";
import type { FocusStore } from "./focusStore";

/** Les éléments d'une rangée : `<préfixe>:<index>` — pas les boutons de leur plateau (`…:tray:…`). */
export function rowItems(prefix: string): (focusKey: string) => boolean {
  const item = new RegExp(`^${prefix}:\\d+$`);
  return (focusKey) => item.test(focusKey);
}

/**
 * Le guide d'ENTRÉE d'un groupe (`FocusGroup`) : quand le focus y arrive
 * d'ailleurs, il atterrit sur la dernière clé du groupe qui l'a eu — ou,
 * `remember` coupé ou rien encore visité, sur l'entrée par défaut
 * (`fallback` : l'onglet de la saison affichée, l'épisode à reprendre, la
 * première carte, Lecture).
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
 * pont du lecteur l'a payé : `BridgeGuide`).
 */

export interface EntryGuideOptions {
  /** Les clés dont le groupe se souvient (`episode:<i>`… — pas le plateau d'une carte). */
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
      const visited = remember && last.current && store.node(last.current) ? last.current : null;
      const key = visited ?? fallback();
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
        focusable={target.length > 0 ? undefined : false}
        trapFocusLeft={trapLeft}
        trapFocusRight={trapRight}
      >
        {children}
      </TVFocusGuideView>
    );
  };
}
