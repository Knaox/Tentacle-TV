import { ViewType, type ReactVideoProps } from "react-native-video";

/**
 * La surface de la vidéo d'aperçu, sur Android TV : une `TextureView` (pas la
 * `SurfaceView` du lecteur), seule à suivre l'opacité de la zone d'aperçu qui
 * la porte. Jamais focalisable — la télécommande reste aux cartes. Ne sert
 * plus qu'au repli d'un binaire sans lecteur d'aperçu natif
 * (`previewVideoElement.android.tsx`).
 *
 * ⚠️ react-native-video 6.19 ne fait encore rien de `viewType` sur Android
 * (`ExoPlayerView.updateSurfaceView` est vide) : le lecteur garde sa
 * `SurfaceView` (constat du 16/10, lot ba1016).
 */
export const PREVIEW_VIDEO_SURFACE: Partial<ReactVideoProps> = { focusable: false, viewType: ViewType.TEXTURE };
