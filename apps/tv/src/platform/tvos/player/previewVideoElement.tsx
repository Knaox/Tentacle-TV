/**
 * La vidéo d'aperçu sur Apple TV : react-native-video (AVPlayer). Jumeau
 * Android : `previewVideoElement.android.tsx`, aux MÊMES noms.
 */
export { RnvPreviewVideo as PreviewVideoElement } from "./previewVideoRnv";

/**
 * Le lecteur sait-il CHANGER DE SOURCE sans être remonté ? Pas react-native-video
 * (6.19, AVPlayer) : une source posée pendant le chargement de la précédente
 * reste en attente (`isSetSourceOngoing`, `nextSource`) et, une fois coincée,
 * plus aucune ne se charge — plus aucune vidéo après quelques aperçus (lot 1
 * du testeur, 18/10). Sur Apple TV, la zone remonte donc l'élément à chaque
 * source : toujours un seul lecteur à la fois, jamais pendant une rafale (la
 * source ne change qu'au focus tenu).
 */
export const PREVIEW_VIDEO_SWAPS_SOURCE = false;
export type { PreviewVideoElementProps } from "./previewVideoTypes";
