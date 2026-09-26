/**
 * Le lecteur du miroir de l'app mobile : la surcouche tactile posée sur le
 * moteur web (`VideoPlayer`), son pont, et l'écran de chargement que la page
 * `WatchWeb` montre avant que le lecteur n'existe.
 */
export { MirrorPlayerOverlay } from "./MirrorPlayerOverlay";
export { MirrorPlayerLoadingScreen } from "./loading/MirrorPlayerLoadingScreen";
export { useMirrorPlayerBridge } from "./useMirrorPlayerBridge";
export type { MirrorPlayerBridge, MirrorPlayerMedia, MirrorPlayerOverlayProps } from "./types";
