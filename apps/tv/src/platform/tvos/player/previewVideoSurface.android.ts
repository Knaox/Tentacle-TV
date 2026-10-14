import { ViewType, type ReactVideoProps } from "react-native-video";

/**
 * La surface de la vidéo d'aperçu, sur Android TV : une `TextureView` (pas la
 * `SurfaceView` du lecteur), seule à suivre l'opacité de la grande carte qui
 * la porte. Jamais focalisable — la télécommande reste à la carte.
 */
export const PREVIEW_VIDEO_SURFACE: Partial<ReactVideoProps> = { focusable: false, viewType: ViewType.TEXTURE };
