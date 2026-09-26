import { RAIL_WIDTH } from "../../responsive";
import { useSideNav, useViewport } from "../../useFormFactor";
import { isProfileSplit } from "./panes";

/**
 * Le profil est-il en maître-détail ? Tablette dont la largeur utile (rail
 * ôté) atteint 720. Le rail se déduit du gabarit plutôt que du contexte de la
 * coquille : `/settings/:pane` peut être monté hors de `MirrorLayout`.
 */
export function useProfileSplit(): boolean {
  const { formFactor, width } = useViewport();
  const sideNav = useSideNav();
  return isProfileSplit(formFactor === "tablet", width, sideNav ? RAIL_WIDTH : 0);
}
