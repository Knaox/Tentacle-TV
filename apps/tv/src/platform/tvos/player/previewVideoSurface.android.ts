import { ViewType, type ReactVideoProps } from "react-native-video";

/**
 * La surface de la vidéo d'aperçu, sur Android TV : une `TextureView` (pas la
 * `SurfaceView` du lecteur), seule à suivre l'opacité de la grande carte qui
 * la porte. Jamais focalisable — la télécommande reste à la carte ; les
 * contrôles d'ExoPlayer non plus (`previewVideoShield.android.tsx`).
 *
 * ⚠️ react-native-video 6.19 ne fait encore rien de `viewType` sur Android
 * (`ExoPlayerView.updateSurfaceView` est vide) : le lecteur garde sa
 * `SurfaceView` (constat du 16/10, lot ba1016).
 */
export const PREVIEW_VIDEO_SURFACE: Partial<ReactVideoProps> = { focusable: false, viewType: ViewType.TEXTURE };
