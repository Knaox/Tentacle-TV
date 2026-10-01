import { useCallback } from "react";
import { useRoute } from "@react-navigation/native";
import { railBackStep } from "@tentacle-tv/tv-core";
import { RAIL_ROUTES } from "../../navigation/railNavigate";
import { useBackLayer } from "../back/BackScope";
import { useKeyFocused } from "../focus/useKeyFocused";
import { navKeyOf } from "../nav/useRailState";
import type { RedesignScreenModel } from "./useRedesignScreen";

const SETTINGS = navKeyOf("Settings");

/**
 * Les couches du Retour d'un écran à navigation (`RedesignScreen`).
 *
 * Sur une page du RAIL (`RAIL_ROUTES`), la règle de `railBackStep` :
 * - le focus dans la page : le rail s'ouvre, sur l'entrée de la page (couche
 *   « page ») ;
 * - le rail ouvert : le focus va sur Réglages (couche « rail ») ;
 * - déjà sur Réglages : aucune couche — l'appui revient à UIKit, qui quitte
 *   l'application.
 *
 * Une page POUSSÉE qui montre le rail (l'étagère d'une personne) n'inscrit
 * rien ici : la couche par défaut de sa portée la fait reculer, rail ouvert ou
 * non (`BackScope`).
 *
 * Et, sur toutes : l'organisation du rail — Retour annule un déplacement
 * (`cancelIfMoving`) et ferme le menu d'une entrée (`NavMenuModal`).
 */
export function useRailBackLayers(screen: RedesignScreenModel): void {
  const { focus, railFocused, focusRail, arrange } = screen;
  const railPage = RAIL_ROUTES.has(useRoute().name);
  const onSettings = useKeyFocused(focus, SETTINGS);
  const step = railBackStep({ railFocused, onSettings });
  const toSettings = useCallback(() => void focus.claim(SETTINGS), [focus]);
  const { cancelIfMoving, closeMenu } = arrange;
  const cancelMove = useCallback(() => void cancelIfMoving(), [cancelIfMoving]);

  useBackLayer("page", railPage && step === "openRail", focusRail);
  useBackLayer("rail", railPage && step === "toSettings", toSettings);
  useBackLayer("menu", arrange.movingKey !== null, cancelMove);
  useBackLayer("menu", arrange.menu !== null, closeMenu);
}
