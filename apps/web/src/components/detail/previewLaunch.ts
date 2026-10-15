import type { LaunchBox } from "./previewLaunchGeometry";

/**
 * Le DÉPART DEPUIS L'APERÇU : la fiche s'ouvre alors qu'une mini-carte de
 * bande-annonce recouvre la carte cliquée (son plateau « Plus d'infos », le
 * clic sur sa vidéo, une affiche comme une vignette).
 *
 * Avant, le calque d'ouverture faisait voler l'image de la CARTE — effacée
 * sous la mini-carte, à sa petite place — pendant que la mini-carte restait
 * là, puis disparaissait d'un bloc avec la page quittée ; et un fond sombre
 * montait sur tout l'écran avant que le décor de la fiche (chargé à ce
 * moment-là, jamais avant) ne soit peint : le « petit flash noir ».
 *
 * Ici, ce qu'on regardait part : l'image VUE dans la mini-carte (la vidéo à
 * l'instant du clic, copiée une fois dans un canevas ; sinon l'image du titre
 * qu'elle montrait), à sa place exacte. La mini-carte s'efface aussitôt sous
 * elle (`data-launched`, `cardPreview.css`) et se tait.
 *
 * Lu dans le DOM, sans rien importer de la mini-carte : le client des
 * téléviseurs LG compile ce module, pas la mini-carte.
 */
export interface PreviewLaunch {
  /** La place de l'image dans la mini-carte, en coordonnées de fenêtre. */
  rect: LaunchBox;
  /** L'image de la vidéo au moment du clic — `null` si elle n'était pas encore vue. */
  frame: HTMLCanvasElement | null;
  /** L'image du titre que montrait la mini-carte, à défaut de vidéo. */
  stillUrl: string | null;
}

/** La plus grande largeur copiée : assez pour un plein écran en fondu, une seule copie. */
const MAX_FRAME_WIDTH = 1280;

/** La mini-carte VUE de cette carte : il n'y en a jamais qu'une à l'écran. */
function shownPreviewOf(visual: HTMLElement): HTMLElement | null {
  if (visual.dataset.concealed !== "true") return null;
  return document.querySelector<HTMLElement>("[data-card-preview][data-shown='true']");
}

/** La vidéo est-elle ce qu'on voyait (première image là, plus en attente sous l'image du titre) ? */
function videoSeen(video: HTMLVideoElement | null): video is HTMLVideoElement {
  return video !== null
    && video.readyState >= 2
    && video.videoWidth > 0
    && !video.classList.contains("is-waiting");
}

/**
 * Copie l'image affichée : `object-fit: cover`, puis le rognage du letterbox
 * incrusté (`--pv-video-crop`, une échelle autour du centre) — le canevas
 * montre exactement ce que montrait la scène.
 */
function copyFrame(video: HTMLVideoElement, box: LaunchBox, stage: HTMLElement): HTMLCanvasElement | null {
  try {
    const width = Math.min(MAX_FRAME_WIDTH, Math.max(video.videoWidth, Math.round(box.width)));
    const height = Math.max(1, Math.round((width * box.height) / box.width));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const crop = Number.parseFloat(getComputedStyle(stage).getPropertyValue("--pv-video-crop")) || 1;
    const scale = Math.max(width / video.videoWidth, height / video.videoHeight) * crop;
    const drawnWidth = video.videoWidth * scale;
    const drawnHeight = video.videoHeight * scale;
    context.drawImage(video, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
    return canvas;
  } catch {
    return null;
  }
}

/**
 * La mini-carte vue de cette carte, prise au vol : son image, sa place — et
 * la mini-carte s'efface et se tait. `null` hors aperçu : l'ouverture
 * ordinaire, depuis la carte.
 */
export function capturePreviewLaunch(visual: HTMLElement | null): PreviewLaunch | null {
  if (!visual || typeof document === "undefined") return null;
  const preview = shownPreviewOf(visual);
  const stage = preview?.querySelector<HTMLElement>(".card-preview-stage") ?? null;
  if (!preview || !stage) return null;
  const r = stage.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const rect = { top: r.top, left: r.left, width: r.width, height: r.height };
  const video = stage.querySelector<HTMLVideoElement>("video");
  const frame = videoSeen(video) ? copyFrame(video, rect, stage) : null;
  const still = stage.querySelector<HTMLImageElement>(".card-preview-backdrop");
  const stillUrl = still && still.complete && still.naturalWidth > 0 ? still.currentSrc || still.src : null;
  if (!frame && !stillUrl) return null;
  preview.dataset.launched = "true";
  // Le son part avec l'image : la vidéo vit encore le temps de la sortie de la page.
  if (video) video.muted = true;
  return { rect, frame, stillUrl };
}
