/**
 * Octave (mobile) — les PRIMITIVES de mise en page communes aux écrans du mode
 * (téléphone et tablette). Les axes s'en servent au lieu de recopier marges,
 * en-têtes et verre — cf. le journal du lot pour le mode d'emploi.
 */
export { OctavePage, OctaveLargeTitle } from "./OctavePage";
export { OctaveTopBar, LARGE_TITLE_SPAN } from "./OctaveTopBar";
export { OctaveSection } from "./OctaveSection";
export { OctaveShelf } from "./OctaveShelf";
export { OctaveGlass, type OctaveGlassProps } from "./OctaveGlass";
export { PressableScale } from "./PressableScale";
export { useOctaveLayout, octaveLayoutOf, type OctaveLayout } from "./useOctaveLayout";
export { useOctavePageScroll, OCTAVE_TOP_BAR_HEIGHT, type OctavePageScroll } from "./useOctavePageScroll";
export { useOctaveColors, type OctaveColors } from "../theme/octaveColors";
export { useOctaveChrome, type OctaveChrome } from "../shell/octaveChrome";
export { OctaveBrandFill } from "./OctaveBrandFill";
export { OctavePlayButton } from "./OctavePlayButton";
