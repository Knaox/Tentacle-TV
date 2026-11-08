/**
 * Octave (mobile) — la page est-elle celle qu'on REGARDE ? La pile d'expo-router garde montées les pages
 * dessous (un album sous un autre album, sous les Réglages) : elles perdent le focus de la pile (`useFocusEffect`,
 * le même signal que la préparation des albums, `albumWarmupScope`). `OctaveRoute` pose une portée par page ;
 * dedans, `useOctavePageFocused()` le lit. La portée tient un MAGASIN stable : changer de page ne redessine que
 * ceux qui le lisent, jamais la page entière. Hors d'une page (mini-lecteur, recouvrements) : vrai.
 */

import { createContext, useCallback, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { useFocusEffect } from "expo-router";
import { ValueStore } from "@tentacle-tv/shared/octave";

const PageFocusContext = createContext<ValueStore<boolean> | null>(null);

export function OctavePageFocusScope({ children }: { children: ReactNode }) {
  // Vrai d'emblée : une page qui naît est celle qu'on ouvre ; une page qui naît dessous le perd aussitôt.
  const [store] = useState(() => new ValueStore(true));
  useFocusEffect(
    useCallback(() => {
      store.set(true);
      return () => store.set(false);
    }, [store]),
  );
  return <PageFocusContext.Provider value={store}>{children}</PageFocusContext.Provider>;
}

const noSubscription = () => () => undefined;
const alwaysFocused = () => true;

export function useOctavePageFocused(): boolean {
  const store = useContext(PageFocusContext);
  return useSyncExternalStore(store ? store.subscribe : noSubscription, store ? store.get : alwaysFocused, store ? store.get : alwaysFocused);
}
