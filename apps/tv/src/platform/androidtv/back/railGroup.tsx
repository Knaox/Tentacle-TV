import { useState } from "react";
import { TVFocusGuideView } from "react-native";
import { RAIL_GROUP_KEY } from "@tentacle-tv/tv-core";
import type { FocusGroupContainerProps } from "../../../redesign/focus/focusBinding";
import { NativeFocusSection } from "../../../redesign/focus/nativeFocusSection";
import type { FocusStore } from "../../tvos/focus/focusStore";

/**
 * Le GROUPE du rail sur Android TV : HAUT et BAS ne le quittent pas, comme
 * sur l'Apple TV, où ce que le rail ouvert recouvre n'est jamais visé. Sans
 * lui, `FocusFinder` filait dans le contenu (BAS depuis la dernière
 * bibliothèque : une carte sous le rail) et préférait à DROITE une carte
 * recouverte au pont qui rend la dernière carte visitée.
 *
 * Deux pièces : un piège HAUT / BAS (`trapFocusUp` / `trapFocusDown`,
 * `ReactViewGroup.focusSearch`), et la section native (`TentacleFocusSection`,
 * sans voisins) : les flèches du rail passent alors par son moteur au
 * faisceau (`BeamSearch`), où un guide l'emporte sur ce qu'il recouvre.
 */
function RailGroupContainer({ style, pointerEvents, children }: FocusGroupContainerProps) {
  const guide = (
    <TVFocusGuideView trapFocusUp trapFocusDown style={NativeFocusSection ? FILL : style} pointerEvents={pointerEvents}>
      {children}
    </TVFocusGuideView>
  );
  if (!NativeFocusSection) return guide;
  return (
    <NativeFocusSection style={style} pointerEvents={pointerEvents} revealMode="none" revealResponse={0.5} revealDamping={1}>
      {guide}
    </NativeFocusSection>
  );
}

const FILL = { flex: 1 } as const;

/** Lie le groupe du rail avant le premier rendu de l'écran (le port l'exige). */
export function useRailGroup(focus: FocusStore): void {
  useState(() => {
    focus.bind(RAIL_GROUP_KEY, { container: RailGroupContainer });
    return true;
  });
}
