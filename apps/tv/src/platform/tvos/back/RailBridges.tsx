import { useEffect, useReducer } from "react";
import { StyleSheet, TVFocusGuideView } from "react-native";
import { RAIL_HOME_KEY, navKeyOf, railBridge, railEntryTarget, type RailFrame } from "@tentacle-tv/tv-core";
import { TV_STAGE } from "@tentacle-tv/theme";
import type { FocusStore } from "../focus/focusStore";
import { TVOS_REMOTE_SUPPORTED } from "../input";

/**
 * Les PONTS de focus entre la navigation et le contenu (tvOS) — l'applicateur
 * de `railBridge` (tv-core `nav/railShortcuts`) : un guide invisible sur la
 * zone qu'il décide.
 *
 * - contenu focalisé : la bande à gauche du contenu mène à l'entrée active du
 *   rail, sinon à Accueil (`railEntryTarget`) ;
 * - rail focalisé : la zone à droite du rail OUVERT rend le focus à la
 *   dernière cible de contenu, sinon à l'entrée de l'écran.
 *
 * Jamais montés ensemble : posé sur la navigation elle-même, le premier
 * capterait ses HAUT et BAS.
 */

const N = TV_STAGE.nav;

export interface RailBridgesProps {
  focus: FocusStore;
  railFocused: boolean;
  railKey: string;
  /** La clé de contenu que viserait le retour au contenu. */
  contentKey: () => string | null;
  railGeometry: Pick<RailFrame, "left" | "expandedWidth"> | null;
}

export function RailBridges({ focus, railFocused, railKey, contentKey, railGeometry }: RailBridgesProps) {
  // Un guide vise un nœud : se redessiner quand l'entrée active arrive ou part.
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const watched = new Set([navKeyOf(railKey), navKeyOf(RAIL_HOME_KEY)]);
    refresh();
    return focus.subscribeNodes((key) => {
      if (watched.has(key)) refresh();
    });
  }, [focus, railKey]);

  if (!TVOS_REMOTE_SUPPORTED) return null;

  const bridge = railBridge({
    railFocused,
    contentKey: railFocused ? contentKey() : null,
    frame: railGeometry,
    defaults: { left: N.left, expandedWidth: N.expandedWidth },
    contentLeft: TV_STAGE.contentLeft,
  });
  const targetKey = bridge.kind === "exit" ? bridge.target : railEntryTarget(railKey, (key) => focus.node(key) !== null);
  const target = targetKey ? focus.node(targetKey) : null;
  return target ? <TVFocusGuideView destinations={[target]} style={[styles.zone, bridge.zone]} /> : null;
}

const styles = StyleSheet.create({
  zone: { position: "absolute" },
});
