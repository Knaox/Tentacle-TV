import { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";

/**
 * L'état du rail pour ce qui se dessine DANS ses capsules : ses entrées, et
 * l'élément posé au-dessus du profil (`NavRailProps.accessory` — les demandes
 * en cours, quand Vigie est là).
 *
 * - `expanded` : le rail est ouvert (le focus y est) ;
 * - `openness` : l'ouverture, 0 → 1, sur le fil de l'interface — les libellés
 *   s'y fondent, en même temps que le verre s'élargit ;
 * - `itemWidth` : la largeur d'une entrée MAINTENANT — repliée, `ITEM` (un
 *   carré centré dans la bande) ; ouverte, celle que la largeur mesurée du
 *   rail lui laisse.
 */
export interface NavFrame {
  expanded: boolean;
  openness: SharedValue<number>;
  itemWidth: number;
}

export const NavFrameContext = createContext<NavFrame | null>(null);

/** L'état du rail, depuis un élément rendu dans l'une de ses capsules. */
export function useNavFrame(): NavFrame {
  const frame = useContext(NavFrameContext);
  if (!frame) throw new Error("useNavFrame : à utiliser dans un NavRail");
  return frame;
}
