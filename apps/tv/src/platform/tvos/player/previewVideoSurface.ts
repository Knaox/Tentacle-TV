import type { ReactVideoProps } from "react-native-video";

/**
 * La surface de la vidéo d'aperçu (bande-annonce au focus d'une carte), sur
 * Apple TV : la couche d'AVPlayer suit déjà l'opacité de sa vue. Jamais
 * focalisable — la télécommande reste à la carte. Jumeau Android :
 * `previewVideoSurface.android.ts`, aux MÊMES noms.
 */
export const PREVIEW_VIDEO_SURFACE: Partial<ReactVideoProps> = { focusable: false };
