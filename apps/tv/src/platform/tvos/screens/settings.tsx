import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet, TVFocusGuideView, type View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import {
  NAV_SETTINGS_AFTER_RESET,
  SETTINGS_PANEL_GROUP,
  SETTINGS_TABS_GROUP,
  navSettingsLockedKeys,
  navSettingsRowKey,
  settingsEntryKey,
} from "@tentacle-tv/tv-core";
import type { FocusGroupContainerProps } from "../../../redesign/focus/focusBinding";
import { claimAfterRestore } from "../focus/claimAfterRestore";
import { setFocusLocked } from "../focus/focusLocks";
import { AutoFocusGuide } from "../focus/focusGuides";
import type { FocusStore } from "../focus/focusStore";

/**
 * L'applicateur tvOS des RÉGLAGES — les décisions sont celles de tv-core
 * (`focus/settingsFocus.ts`, `nav/arrange.ts` ; relevé RG-1 à RG-12) ; ce
 * module ne fait que les poser :
 * - la colonne des onglets (`settings:tabs`) est un guide dont la destination
 *   est l'onglet AFFICHÉ ; il descend jusqu'au bas du panneau (GAUCHE depuis
 *   un bouton posé plus bas que le dernier onglet le rencontre encore — sinon
 *   il filait à la navigation) ;
 * - le panneau (`settings:panel`) mémorise : DROITE depuis un onglet y rentre
 *   là où on l'avait laissé ;
 * - Réglages › Navigation : les verrous d'un déplacement, la case rendue
 *   après une annulation, la première ligne après « Tout afficher ».
 */

const TabDestinationContext = createContext<View[]>([]);

/** Le guide de la colonne : conteneur stable, destination lue dans le contexte. */
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

/** Les guides naissent avec l'écran : un groupe se lie avant son premier rendu. */
export function useSettingsGroups(focus: FocusStore): void {
  useState(() => {
    focus.bind(SETTINGS_TABS_GROUP, { container: TabsGuide });
    focus.bind(SETTINGS_PANEL_GROUP, { container: AutoFocusGuide });
  });
}

/** Le nœud de l'onglet affiché, suivi jusqu'à son montage : la destination de la colonne. */
export function useActiveTabDestination(focus: FocusStore, tab: string): View[] {
  const key = settingsEntryKey(tab);
  const [node, setNode] = useState<View | null>(() => focus.node(key));
  useEffect(() => {
    setNode(focus.node(key));
    return focus.subscribeNodes((changed, mounted) => {
      if (changed === key) setNode(mounted);
    });
  }, [focus, key]);
  return useMemo(() => (node ? [node] : []), [node]);
}

/** Réglages › Navigation : ce que le déplacement d'une ligne pose sur le focus. */
export function useNavSettingsFocus(focus: FocusStore) {
  /** Pendant un déplacement, rien d'autre que les lignes n'est focalisable. */
  const lockOthers = useCallback((locked: boolean, rowCount: number) => {
    for (const key of navSettingsLockedKeys(rowCount)) setFocusLocked(focus, key, locked);
  }, [focus]);
  /** Retour a annulé le déplacement : le focus revient à la case de départ. */
  const returnToRow = useCallback((slot: number) => claimAfterRestore(focus, navSettingsRowKey(slot)), [focus]);
  /** « Tout afficher », « Ordre par défaut » : la première ligne. */
  const toFirstRow = useCallback(() => {
    focus.claim(NAV_SETTINGS_AFTER_RESET);
  }, [focus]);
  return { lockOthers, returnToRow, toFirstRow };
}
