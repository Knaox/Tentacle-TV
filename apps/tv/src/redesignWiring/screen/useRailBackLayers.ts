import { useCallback } from "react";
import { useRoute } from "@react-navigation/native";
import { RAIL_PROFILE_FOCUS_KEY, isRailPage, railScreenBackLayers } from "@tentacle-tv/tv-core";
import { useBackLayers } from "../back/BackScope";
import { useKeyFocused } from "../../platform/tvos/focus/useKeyFocused";
import { useAwayFromRowStart } from "../../platform/tvos/focus/useRowRewind";
import type { RedesignScreenModel } from "./useRedesignScreen";

/**
 * Les couches du Retour d'un écran à navigation (`RedesignScreen`) : la règle
 * est dans tv-core (`railScreenBackLayers`) — dans une rangée défilée de
 * l'accueil ou de « Pour vous », la première carte ; puis, sur une page du
 * rail, le rail s'ouvre, puis le profil, puis la sortie ; sur tout écran à
 * rail, Retour annule un déplacement et ferme le menu d'une entrée. On inscrit
 * ses couches et on y branche les gestes.
 */
export function useRailBackLayers(screen: RedesignScreenModel): void {
  const { focus, railFocused, focusRail, arrange, rows } = screen;
  const railPage = isRailPage(useRoute().name);
  const onProfile = useKeyFocused(focus, RAIL_PROFILE_FOCUS_KEY);
  const awayFromRowStart = useAwayFromRowStart(focus, rows);
  const toProfile = useCallback(() => void focus.claim(RAIL_PROFILE_FOCUS_KEY), [focus]);
  const toRowStart = useCallback(() => {
    const key = rows?.backTarget(focus.focusedKey());
    if (key) focus.claim(key);
  }, [focus, rows]);
  const { cancelIfMoving, closeMenu } = arrange;
  const cancelMove = useCallback(() => void cancelIfMoving(), [cancelIfMoving]);

  useBackLayers(
    railScreenBackLayers({ railPage, railFocused, onProfile, moving: arrange.movingKey !== null, menuOpen: arrange.menu !== null, awayFromRowStart }),
    { rowStart: toRowStart, openRail: focusRail, toProfile, cancelMove, closeMenu },
  );
}
