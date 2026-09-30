import { useCallback, useLayoutEffect, useRef } from "react";
import { useAnimatedReaction, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { motionTo } from "./motion";

/**
 * Les voisines qui RECULENT quand une carte d'une rangée a le focus — sans un
 * seul rendu React. La rangée tient l'index focalisé dans une valeur partagée
 * (`useRowFocus`) ; chaque carte le lit sur le fil d'interface (`useRecede`)
 * et lance son propre recul quand sa cible change. Avant, l'index vivait
 * dans l'état de la rangée : chaque pas du focus redessinait TOUTES ses
 * cartes pour changer une opacité.
 */

/** La place d'une carte dans sa rangée : de quoi savoir si elle recule. */
export interface RowPlace {
  row: SharedValue<number>;
  index: number;
}

/**
 * L'index focalisé d'une rangée (-1 : aucun). `forcedIndex` : le focus figé du
 * banc, quand `forced` — il l'emporte sur le focus natif.
 */
export function useRowFocus(forced: boolean, forcedIndex: number | null): {
  row: SharedValue<number>;
  onItemFocusChange: (index: number, focused: boolean) => void;
} {
  const row = useSharedValue(-1);
  const forcedRef = useRef(forced);
  forcedRef.current = forced;
  const release = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (forced) row.value = forcedIndex ?? -1;
  }, [forced, forcedIndex, row]);
  useLayoutEffect(() => () => {
    if (release.current) clearTimeout(release.current);
  }, []);

  const onItemFocusChange = useCallback(
    (index: number, focused: boolean) => {
      if (forcedRef.current) return;
      if (release.current) {
        clearTimeout(release.current);
        release.current = null;
      }
      if (focused) {
        row.value = index;
        return;
      }
      // La perte du focus d'une carte arrive souvent AVANT la prise de la
      // suivante : « aucune » n'est dit qu'un instant après, si personne n'a
      // pris la relève — les voisines ne se rallument pas entre deux pas.
      release.current = setTimeout(() => {
        release.current = null;
        if (row.value === index) row.value = -1;
      }, 32);
    },
    [row],
  );
  return { row, onItemFocusChange };
}

/** 0 → 1 quand une voisine de `place` a le focus, sur le fil d'interface. */
export function useRecede(place: RowPlace | undefined): SharedValue<number> {
  const reduced = useReducedMotion();
  const recede = useSharedValue(0);
  const row = place?.row;
  const index = place?.index ?? -1;
  useAnimatedReaction(
    () => (row !== undefined && row.value >= 0 && row.value !== index ? 1 : 0),
    (target, previous) => {
      if (target !== previous && previous !== null) recede.value = motionTo(target, "recede", reduced);
      else if (previous === null) recede.value = target;
    },
    [row, index, reduced],
  );
  return recede;
}
