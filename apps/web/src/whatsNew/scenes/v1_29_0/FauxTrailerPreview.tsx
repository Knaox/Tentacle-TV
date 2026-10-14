import type { Transition } from "framer-motion";
import { Volume2 } from "lucide-react";
import { easeOut } from "../../../theme/motion";
import { CARD_TONES } from "../FauxCard";
import { Place, type Animated, type Placed } from "../Place";
import { sceneTween } from "../sceneMotion";
import type { SceneTrailer } from "./previewSceneMedia";
import { FauxPreviewBand } from "./FauxPreviewBand";
import { PREVIEW_H, PREVIEW_W, VIDEO_H } from "./previewSceneGeometry";

interface FauxTrailerPreviewProps extends Placed, Animated {
  trailer: SceneTrailer;
  /** Le plan de la vidéo : -1 = l'image du titre (agrandissement), puis 0, 1… */
  shot: number;
  /** Posée : le contenu du bandeau monte, d'un seul bloc. */
  settled: boolean;
  /** « Ma liste » cochée. */
  listed: boolean;
  transition?: Transition;
}

/** Un plan de la vidéo : il avance et glisse lentement tant qu'il est à l'écran — c'est le mouvement. */
const SHOT_MOTION: Transition = { opacity: sceneTween, scale: { duration: 3.2, ease: "linear" }, x: { duration: 3.2, ease: "linear" } };
/**
 * Le graphite NEUTRE de la boîte (`previewSurface.css`), opaque — la vidéo en
 * couvre le haut : #141416 → #0e0e10, sous une lumière blanche de 4 % qui
 * s'éteint vers le bas. Aucune teinte : la marque n'est plus qu'en touches
 * (l'étoile de la note, la barre de progression).
 */
const PANEL =
  `linear-gradient(180deg, rgba(255, 255, 255, 0.04) ${VIDEO_H}px, rgba(255, 255, 255, 0) 100%),` +
  `linear-gradient(180deg, #141416 ${VIDEO_H}px, #0e0e10 100%)`;
/** La couleur VUE en haut du bandeau (le graphite sous sa lumière) : la vidéo y fond, sans marche. */
const PANEL_FACE = "rgb(29, 29, 31)";
/** Une ombre large et douce, et un contour d'un pixel : sur fond noir, c'est le contour qui détache la boîte. */
const FRAME_SHADOW = "0 20px 40px -15px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.06)";
/** Le liseré de lumière d'un pixel en haut, et le contour intérieur, PAR-DESSUS la vidéo. */
const FRAME_LIGHT = "inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.04)";
/** Le contenu du bandeau monte de 6 px d'UN SEUL bloc, la mini-carte presque posée (`previewActions.css`). */
const RISE: Transition = { opacity: { duration: 0.22, ease: easeOut, delay: 0.16 }, y: { duration: 0.28, ease: easeOut, delay: 0.16 } };

/**
 * La mini-carte d'aperçu, en faux, au dessin de `components/cards/preview/`
 * (recopié : le client LG ne compile pas ce dossier) : la VIDÉO 16:9 nue en
 * haut — l'image du titre pendant l'agrandissement, puis des plans qui
 * bougent —, le seul bouton du son en rond cerclé ; dessous, le BANDEAU de
 * verre sombre teinté de la marque, dont le contenu (`FauxPreviewBand`) monte
 * d'un seul bloc la mini-carte presque posée. Inerte : c'est la scène qui joue.
 */
export function FauxTrailerPreview({ trailer, shot, settled, listed, transition, ...place }: FauxTrailerPreviewProps) {
  return (
    // Au-dessus des cartes de la rangée : leurs badges ont leur propre z-index.
    <Place {...place} w={PREVIEW_W} h={PREVIEW_H} transition={transition} style={{ zIndex: 15 }}>
      <div className="relative h-full w-full overflow-hidden rounded-[10px]" style={{ background: PANEL, boxShadow: FRAME_SHADOW }}>
        <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: VIDEO_H }}>
          {trailer.still ? (
            <img src={trailer.still} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: CARD_TONES[1] }} />
          )}
          {trailer.shots.map((url, i) => (
            <Place key={i} x={0} y={0} w={PREVIEW_W} h={VIDEO_H} visible={shot >= i} scale={shot >= i ? 1.14 : 1} dx={shot >= i ? (i % 2 === 0 ? -7 : 7) : 0} transition={SHOT_MOTION}>
              <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
            </Place>
          ))}
          {/* La vidéo fond dans le verre sur son dernier sixième (`previewSurface.css`). */}
          <div className="absolute inset-0" style={{ background: `linear-gradient(0deg, ${PANEL_FACE} 0%, rgba(29, 29, 31, 0.5) 7%, rgba(29, 29, 31, 0) 17%)` }} />
          {/* Le son : un rond graphite, sans liseré. */}
          <span className="absolute right-1.5 top-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full text-white" style={{ background: "rgba(28, 28, 30, 0.6)" }}>
            <Volume2 className="h-[9px] w-[9px]" strokeWidth={2} aria-hidden />
          </span>
        </div>
        <Place x={0} y={VIDEO_H} w={PREVIEW_W} h={PREVIEW_H - VIDEO_H} visible={settled} dy={settled ? 0 : 6} transition={RISE}>
          <FauxPreviewBand trailer={trailer} listed={listed} />
        </Place>
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[10px]" style={{ boxShadow: FRAME_LIGHT }} />
      </div>
    </Place>
  );
}

