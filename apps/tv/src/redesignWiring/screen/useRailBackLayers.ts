import { useCallback } from "react";
import { useRoute } from "@react-navigation/native";
import { RAIL_PROFILE_FOCUS_KEY, isRailPage, railScreenBackLayers } from "@tentacle-tv/tv-core";
import { useBackLayers } from "../back/BackScope";
import { useKeyFocused } from "../../platform/tvos/focus/useKeyFocused";
import type { RedesignScreenModel } from "./useRedesignScreen";

/**
 * Les couches du Retour d'un écran à navigation (`RedesignScreen`) : la règle
 * est dans tv-core (`railScreenBackLayers`) — sur une page du rail, le rail
 * s'ouvre, puis le profil, puis la sortie ; sur tout écran à rail, Retour
 * annule un déplacement et ferme le menu d'une entrée. On inscrit ses couches
 * et on y branche les gestes.
 */
export function useRailBackLayers(screen: RedesignScreenModel): void {
  const { focus, railFocused, focusRail, arrange } = screen;
  const railPage = isRailPage(useRoute().name);
  const onProfile = useKeyFocused(focus, RAIL_PROFILE_FOCUS_KEY);
  const toProfile = useCallback(() => void focus.claim(RAIL_PROFILE_FOCUS_KEY), [focus]);
  const { cancelIfMoving, closeMenu } = arrange;
  const cancelMove = useCallback(() => void cancelIfMoving(), [cancelIfMoving]);

  useBackLayers(
    railScreenBackLayers({ railPage, railFocused, onProfile, moving: arrange.movingKey !== null, menuOpen: arrange.menu !== null }),
    { openRail: focusRail, toProfile, cancelMove, closeMenu },
  );
}
