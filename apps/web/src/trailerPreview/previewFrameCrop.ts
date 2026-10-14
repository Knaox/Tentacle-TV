import { letterboxCropScale } from "./previewLetterbox";

/**
 * La lecture de la première image, pour le letterbox (`previewLetterbox.ts`) :
 * UNE copie de l'image décodée dans un canevas de 64 × 144 — 36 Ko lus, une
 * fois par aperçu, jamais à chaque image. 1 si rien n'est lisible : vidéo sans
 * dimensions, canevas refusé, ou « taché » (un MP4 servi par une autre origine
 * sans CORS ; un flux HLS passe par MSE, il ne l'est jamais).
 */
const SAMPLE_WIDTH = 64;
const SAMPLE_HEIGHT = 144;

export function measureVideoCrop(video: HTMLVideoElement): number {
  try {
    if (!video.videoWidth || !video.videoHeight || typeof document === "undefined") return 1;
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_WIDTH;
    canvas.height = SAMPLE_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return 1;
    context.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
    const { data } = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
    const boxAspect = video.clientWidth > 0 && video.clientHeight > 0 ? video.clientWidth / video.clientHeight : 16 / 9;
    return letterboxCropScale(
      { data, width: SAMPLE_WIDTH, height: SAMPLE_HEIGHT },
      { sourceAspect: video.videoWidth / video.videoHeight, boxAspect },
    );
  } catch {
    return 1;
  }
}
