import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { FocusExtras, FocusStore } from "../focus/focusStore";
import { isNavKey } from "../nav/useRailState";

/**
 * Où va le focus quand on arrive sur un écran refondu, et quand on y revient.
 *
 * - À l'ARRIVÉE, l'entrée (`entryKey`) porte `hasTVPreferredFocus` dès son
 *   premier rendu : sa cible demande le focus en se montant, avant que tvOS
 *   n'en donne un de lui-même — sinon la navigation, en haut à gauche, le
 *   prenait et s'ouvrait le temps d'un éclair. Une réclamation suit, pour la
 *   cible déjà montée quand l'entrée change (chargement → contenu).
 * - Le premier focus posé dans le contenu CLÔT l'arrivée : l'entrée lâche sa
 *   préférence. L'utilisateur qui gagne la navigation pendant un chargement
 *   la clôt aussi — une affiche arrivée plus tard ne lui volera pas le focus.
 * - Au RETOUR (la pile redescend sur l'écran), le focus revient au dernier
 *   élément de contenu qui l'avait, s'il est encore là ; sinon à l'entrée.
 */

const PREFERRED: FocusExtras = { native: { hasTVPreferredFocus: true } };

/** Un focus dans la navigation plus tard que ça après l'arrivée vient de l'utilisateur. */
const USER_RAIL_AFTER_MS = 600;

export interface EntryFocus {
  /** La clé de contenu à viser : la dernière focalisée si elle est montée, sinon l'entrée. */
  contentKey: () => string | null;
}

export function useEntryFocus(focus: FocusStore, entryKey: string | null): EntryFocus {
  const entryRef = useRef(entryKey);
  entryRef.current = entryKey;
  const lastContent = useRef<string | null>(null);
  const arrival = useRef<{ open: boolean; bound: string | null; cancel: (() => void) | null; at: number }>({
    open: true,
    bound: null,
    cancel: null,
    at: Date.now(),
  });

  // Pendant l'arrivée, l'entrée courante porte la préférence — posée AVANT le
  // rendu des cibles (l'écran rend sa vue après ce hook).
  const state = arrival.current;
  if (state.open && state.bound !== entryKey) {
    if (state.bound) focus.bind(state.bound, null);
    if (entryKey) focus.bind(entryKey, PREFERRED);
    state.bound = entryKey;
  }

  const closeArrival = useCallback(() => {
    const current = arrival.current;
    if (!current.open) return;
    current.open = false;
    current.cancel?.();
    current.cancel = null;
    if (current.bound) focus.bind(current.bound, null);
    current.bound = null;
  }, [focus]);

  // L'entrée qui change pendant l'arrivée : la réclamer (visée dès son montage).
  useEffect(() => {
    const current = arrival.current;
    if (!current.open || !entryKey) return;
    current.cancel?.();
    current.cancel = focus.claim(entryKey);
  }, [focus, entryKey]);

  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (!focused) return;
        if (!isNavKey(key)) {
          lastContent.current = key;
          closeArrival();
        } else if (Date.now() - arrival.current.at > USER_RAIL_AFTER_MS) {
          closeArrival();
        }
      }),
    [focus, closeArrival],
  );
  useEffect(() => () => arrival.current.cancel?.(), []);

  const contentKey = useCallback(() => {
    const last = lastContent.current;
    return last && focus.node(last) ? last : entryRef.current;
  }, [focus]);

  // Le retour : l'écran regagne le focus de la pile (lecteur, fiche refermés).
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return undefined;
      }
      const key = contentKey();
      return key ? focus.claim(key) : undefined;
    }, [focus, contentKey]),
  );

  return { contentKey };
}
