import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, TVFocusGuideView, type View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import type { FocusGroupContainerProps } from "../../redesign/focus/focusBinding";
import type { SettingsTab } from "../../redesign/screens/settings/settingsTypes";
import type { FocusExtras, FocusStore } from "../focus/focusStore";
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

/** Une ligne de la liste qui attend son tour : pas encore focalisable. Sur
 *  tvOS, c'est `isTVSelectable` qui en décide (`RCTTVView.canBecomeFocused`). */
const LOCKED: FocusExtras = { native: { isTVSelectable: false } };
/** Filet : si le premier focus tarde, les lignes se libèrent quand même. */
const RELEASE_AFTER_MS = 800;

type Settable = { setNativeProps?: (props: object) => void };

/** Verrouille ou libère une clé : sa liaison, lue au prochain rendu de la
 *  cible, ET son nœud déjà monté — une cible mémoïsée (un bouton aux props
 *  stables) ne se redessine pas, et gardait son verrou. */
function setLocked(focus: FocusStore, key: string, locked: boolean): void {
  focus.bind(key, locked ? LOCKED : null);
  (focus.node(key) as Settable | null)?.setNativeProps?.({ isTVSelectable: !locked });
}

/**
 * L'entrée de la liste de choix : la valeur retenue. Dans une `Modal`, aucune
 * préférence de focus n'est honorée — le contenu vit dans le contrôleur de la
 * modale, hors de la racine React que `hasTVPreferredFocus` et les
 * réclamations visent (`RCTTVView.rootView` y rend nil) : tvOS focalise
 * l'élément du haut. À l'ouverture, seule la valeur retenue est donc
 * focalisable (posé AVANT que la liste ne se rende) ; au premier focus posé,
 * les autres lignes le redeviennent. Rend un compteur qui change à la
 * libération : la liste se redessine pour la lire (les nœuds déjà montés
 * reçoivent aussi leur verrou directement). Une nouvelle entrée, liste
 * ouverte (l'élément focalisé a disparu), verrouille de nouveau : tvOS, qui
 * cherche un nouveau focus, n'en trouve qu'un. Commun aux listes en Modal
 * (réglages, feuille d'actions, filtres de la bibliothèque).
 */
export function useChoiceEntry(focus: FocusStore, keys: readonly string[], entryKey: string | null): number {
  const [releases, setReleases] = useState(0);
  const opened = useRef<string | null>(null);
  const locked = useRef<string[]>([]);
  if (opened.current !== entryKey) {
    for (const key of locked.current) setLocked(focus, key, false);
    locked.current = entryKey ? keys.filter((key) => key !== entryKey) : [];
    for (const key of locked.current) setLocked(focus, key, true);
    opened.current = entryKey;
  }
  useEffect(() => {
    if (!entryKey) return undefined;
    let done = false;
    const release = () => {
      if (done) return;
      done = true;
      for (const key of locked.current) setLocked(focus, key, false);
      locked.current = [];
      setReleases((count) => count + 1);
    };
    const unsubscribe = focus.subscribe((key, focused) => {
      if (focused && key === entryKey) release();
    });
    const timer = setTimeout(release, RELEASE_AFTER_MS);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [focus, entryKey]);
  return releases;
}
