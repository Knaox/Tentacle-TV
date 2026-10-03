import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  closeArrival,
  closesArrival,
  contentKeyOf,
  entryClaim,
  lastContentAfter,
  preferEntry,
  returnClaim,
  startArrival,
  type ScreenArrival,
} from "@tentacle-tv/tv-core";
import type { FocusExtras, FocusStore } from "./focusStore";
import { isNavKey } from "../../../redesignWiring/nav/useRailState";

/**
 * Où va le focus quand on arrive sur un écran refondu, et quand on y revient
 * — la règle de tv-core (`focus/screenEntry.ts`), appliquée :
 *
 * - à l'ARRIVÉE, l'entrée (`entryKey`) porte `hasTVPreferredFocus` dès son
 *   premier rendu : sa cible demande le focus en se montant, avant que tvOS
 *   n'en donne un de lui-même — sinon la navigation, en haut à gauche, le
 *   prenait et s'ouvrait le temps d'un éclair. Une réclamation suit, pour la
 *   cible déjà montée quand l'entrée change (chargement → contenu) ;
 * - le premier focus posé dans le contenu CLÔT l'arrivée : l'entrée lâche sa
 *   préférence. L'utilisateur qui gagne la navigation pendant un chargement
 *   la clôt aussi — une affiche arrivée plus tard ne lui volera pas le focus ;
 * - au RETOUR (la pile redescend sur l'écran), le focus revient au dernier
 *   élément de contenu qui l'avait, s'il est encore là ; sinon à l'entrée.
 */

const PREFERRED: FocusExtras = { native: { hasTVPreferredFocus: true } };

export interface EntryFocus {
  /** La clé de contenu à viser : la dernière focalisée si elle est montée, sinon l'entrée. */
  contentKey: () => string | null;
}

interface Arrival {
  state: ScreenArrival;
  /** La réclamation en cours de l'entrée. */
  cancel: (() => void) | null;
}

export function useEntryFocus(focus: FocusStore, entryKey: string | null): EntryFocus {
  const entryRef = useRef(entryKey);
  entryRef.current = entryKey;
  const lastContent = useRef<string | null>(null);
  const arrivalRef = useRef<Arrival | null>(null);
  arrivalRef.current ??= { state: startArrival(Date.now()), cancel: null };
  const arrival = arrivalRef.current;

  // Pendant l'arrivée, l'entrée courante porte la préférence — posée AVANT le
  // rendu des cibles (l'écran rend sa vue après ce hook).
  const preference = preferEntry(arrival.state, entryKey);
  if (preference.change) {
    arrival.state = preference.arrival;
    if (preference.change.unprefer) focus.bind(preference.change.unprefer, null);
    if (preference.change.prefer) focus.bind(preference.change.prefer, PREFERRED);
  }

  const endArrival = useCallback(() => {
    const current = arrivalRef.current!;
    const closed = closeArrival(current.state);
    if (closed.arrival === current.state) return;
    current.state = closed.arrival;
    current.cancel?.();
    current.cancel = null;
    if (closed.unprefer) focus.bind(closed.unprefer, null);
  }, [focus]);

  // L'entrée qui change pendant l'arrivée : la réclamer (visée dès son montage).
  useEffect(() => {
    const current = arrivalRef.current!;
    const key = entryClaim(current.state, entryKey);
    if (!key) return;
    current.cancel?.();
    current.cancel = focus.claim(key);
  }, [focus, entryKey]);

  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (!focused) return;
        const inRail = isNavKey(key);
        lastContent.current = lastContentAfter(lastContent.current, key, inRail);
        if (closesArrival(arrivalRef.current!.state, inRail, Date.now())) endArrival();
      }),
    [focus, endArrival],
  );
  useEffect(() => () => arrivalRef.current?.cancel?.(), []);

  const contentKey = useCallback(
    () => contentKeyOf(lastContent.current, entryRef.current, (key) => focus.node(key) !== null),
    [focus],
  );

  // Le retour : l'écran regagne le focus de la pile (lecteur, fiche refermés).
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      const key = returnClaim(first.current, contentKey());
      first.current = false;
      return key ? focus.claim(key) : undefined;
    }, [focus, contentKey]),
  );

  return { contentKey };
}
