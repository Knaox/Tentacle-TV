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
/** Le verre sombre de la boîte, opaque (`previewSurface.css`) — la vidéo en couvre le haut — et son reflet de marque. */
const PANEL_TOP = "rgb(21, 20, 29)";
const PANEL =
  "radial-gradient(70% 55% at 0% 100%, rgba(var(--brand-rgb), 0.13) 0%, rgba(var(--brand-rgb), 0) 100%)," +
  `linear-gradient(180deg, ${PANEL_TOP} ${VIDEO_H}px, rgb(12, 12, 18) 100%)`;
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
      <div className="relative h-full w-full overflow-hidden rounded-[10px] shadow-[0_18px_36px_-14px_rgba(0,0,0,0.95)]" style={{ background: PANEL }}>
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
          <div className="absolute inset-0" style={{ background: `linear-gradient(0deg, ${PANEL_TOP} 0%, rgba(21, 20, 29, 0.5) 7%, rgba(21, 20, 29, 0) 17%)` }} />
          <span className="absolute right-1.5 top-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full border border-white/55 bg-black/40 text-white">
            <Volume2 className="h-[9px] w-[9px]" strokeWidth={2} aria-hidden />
          </span>
        </div>
        <Place x={0} y={VIDEO_H} w={PREVIEW_W} h={PREVIEW_H - VIDEO_H} visible={settled} dy={settled ? 0 : 6} transition={RISE}>
          <FauxPreviewBand trailer={trailer} listed={listed} />
        </Place>
      </div>
    </Place>
  );
}

