import { useEffect, useReducer, useRef, useState } from "react";
import { StyleSheet, TVFocusGuideView } from "react-native";
import {
  RAIL_SHORTCUT_TARGETS, marksContentFocus, railLeftArmDelay, railShortcutZones, railShortcutsActive, type RailFrame,
} from "@tentacle-tv/tv-core";
import type { FocusStore } from "../focus/focusStore";
import { TVOS_REMOTE_SUPPORTED } from "../input";

/**
 * Les RACCOURCIS de la navigation (tvOS) — l'applicateur de tv-core
 * (`nav/railShortcuts`) : trois guides invisibles aux bords des capsules,
 * posés seulement pendant que le focus est dans le rail, hors menu et
 * déplacement — HAUT depuis Rechercher y reste, BAS depuis le profil y reste
 * (le rail s'arrête à ses bouts, il ne boucle plus), GAUCHE → le profil une
 * fois armé (`railLeftArmDelay`). La
 * légende du rail ouvert le dit (« ◀ Profil et réglages »).
 */

export interface RailShortcutsProps {
  focus: FocusStore;
  railFocused: boolean;
  heldKey: string | null;
  movingKey: string | null;
  railGeometry: RailFrame | null;
}

export function RailShortcuts({ focus, railFocused, heldKey, movingKey, railGeometry }: RailShortcutsProps) {
  const active = railShortcutsActive({ railFocused, heldKey, movingKey });
  const [armed, setArmed] = useState(false);
  // Le dernier focus posé dans le contenu : une arrivée juste après lui vient
  // d'une flèche maintenue.
  const lastContentAt = useRef(0);
  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (focused && marksContentFocus(key)) lastContentAt.current = Date.now();
      }),
    [focus],
  );
  useEffect(() => {
    setArmed(false);
    if (!active) return undefined;
    const timer = setTimeout(() => setArmed(true), railLeftArmDelay(lastContentAt.current, Date.now()));
    return () => clearTimeout(timer);
  }, [active]);

  // Un guide vise un nœud : se redessiner quand le profil ou Rechercher arrive.
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(
    () =>
      focus.subscribeNodes((key) => {
        if (key === RAIL_SHORTCUT_TARGETS.above || key === RAIL_SHORTCUT_TARGETS.below) refresh();
      }),
    [focus],
  );

  if (!TVOS_REMOTE_SUPPORTED || !active || !railGeometry) return null;
  const above = focus.node(RAIL_SHORTCUT_TARGETS.above);
  const below = focus.node(RAIL_SHORTCUT_TARGETS.below);
  const left = focus.node(RAIL_SHORTCUT_TARGETS.left);
  const zones = railShortcutZones(railGeometry);
  return (
    <>
      {above ? <TVFocusGuideView destinations={[above]} style={[styles.zone, zones.above]} /> : null}
      {below ? <TVFocusGuideView destinations={[below]} style={[styles.zone, zones.below]} /> : null}
      {armed && left ? <TVFocusGuideView destinations={[left]} style={[styles.zone, zones.left]} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  zone: { position: "absolute" },
});
