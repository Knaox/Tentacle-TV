/**
 * RÉEXPORT PROVISOIRE : l'applicateur de la croix Retour vit dans
 * `platform/tvos/back/backFocus` (docs/TV-NAVIGATION.md, « L'adaptateur
 * tvOS »), ses règles dans tv-core (`nav/backCross`). Ce chemin reste le temps
 * que ses importateurs des autres domaines le visent directement — à retirer
 * ensuite (docs/tv-navigation/retour-rail.md).
 */
export { useBackFocus, type BackFocusOptions } from "../../platform/tvos/back/backFocus";
