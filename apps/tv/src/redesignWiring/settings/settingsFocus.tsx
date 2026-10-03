import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet, TVFocusGuideView, type View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import type { FocusGroupContainerProps } from "../../redesign/focus/focusBinding";
import type { SettingsTab } from "../../redesign/screens/settings/settingsTypes";
import type { FocusStore } from "../focus/focusStore";
import { AutoFocusGuide } from "../focus/focusGuides";

/**
 * Le focus des réglages, que la vue ne décide pas :
 * - la colonne des onglets (`settings:tabs`) est un guide dont la
 *   destination est l'onglet AFFICHÉ : GAUCHE depuis le panneau revient
 *   dessus, jamais sur celui qu'on survolait ;
 * - le panneau (`settings:panel`) mémorise : DROITE depuis un onglet y
 *   rentre là où on l'avait laissé (premier élément à la première visite ;
 *   « À propos » n'a rien de focalisable, le focus reste sur l'onglet) ;
 * - la liste de choix ouverte entre sur la valeur retenue.
 */

const TabDestinationContext = createContext<View[]>([]);

/** Le guide de la colonne : conteneur stable, destination lue dans le contexte.
 *  Il descend jusqu'au bas du panneau : GAUCHE depuis un bouton posé plus bas
 *  que le dernier onglet le rencontre encore (sinon il filait à la navigation). */
function TabsGuide({ style, pointerEvents, children }: FocusGroupContainerProps) {
  const destinations = useContext(TabDestinationContext);
  return (
    <TVFocusGuideView destinations={destinations} style={[style, styles.fullHeight]} pointerEvents={pointerEvents}>
      {children}
    </TVFocusGuideView>
  );
}

const styles = StyleSheet.create({
  fullHeight: { bottom: TV_STAGE.safe.y },
});

export const TabDestinationProvider = TabDestinationContext.Provider;

export const tabFocusKey = (tab: SettingsTab) => `settings:tab:${tab}`;

/** Les guides naissent avec l'écran : un groupe se lie avant son premier rendu. */
export function useSettingsGroups(focus: FocusStore): void {
  useState(() => {
    focus.bind("settings:tabs", { container: TabsGuide });
    focus.bind("settings:panel", { container: AutoFocusGuide });
  });
}

/** Le nœud de l'onglet affiché, suivi jusqu'à son montage. */
export function useActiveTabDestination(focus: FocusStore, tab: SettingsTab): View[] {
  const key = tabFocusKey(tab);
  const [node, setNode] = useState<View | null>(() => focus.node(key));
  useEffect(() => {
    setNode(focus.node(key));
    return focus.subscribeNodes((changed, mounted) => {
      if (changed === key) setNode(mounted);
    });
  }, [focus, key]);
  return useMemo(() => (node ? [node] : []), [node]);
}

/**
 * L'entrée des listes en `Modal` (la valeur retenue, verrouillée seule
 * focalisable jusqu'au premier focus) : la règle est dans tv-core
 * (`panels/choiceEntry`), son application tvOS dans
 * `platform/tvos/panels/useChoiceEntry`. Ré-exportée ici pour ses appelants.
 */
export { useChoiceEntry } from "../../platform/tvos/panels/useChoiceEntry";
