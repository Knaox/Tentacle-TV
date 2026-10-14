import type { Transition } from "framer-motion";
import { Volume2 } from "lucide-react";
import { BookmarkGlyph, HeartGlyph, PlayGlyph, WatchedGlyph } from "../../../components/cards/cardGlyphs";
import { CARD_TONES } from "../FauxCard";
import { Place, type Animated, type Placed } from "../Place";
import { sceneTween } from "../sceneMotion";
import type { SceneTrailer } from "./previewSceneMedia";
import { ACTION, PREVIEW_H, PREVIEW_W, VIDEO_H } from "./previewSceneGeometry";

interface FauxTrailerPreviewProps extends Placed, Animated {
  trailer: SceneTrailer;
  /** Le plan de la vidéo : -1 = l'image du titre (agrandissement), puis 0, 1… */
  shot: number;
  /** « Ma liste » cochée. */
  listed: boolean;
  transition?: Transition;
}

/** Un plan de la vidéo : il avance et glisse lentement tant qu'il est à l'écran — c'est le mouvement. */
const SHOT_MOTION: Transition = { opacity: sceneTween, scale: { duration: 3.2, ease: "linear" }, x: { duration: 3.2, ease: "linear" } };
/** Le fond plein du bandeau, sombre dans les deux schémas (posé sur média), comme l'app. */
const BAND_BG = "rgb(20, 20, 25)";
/** Les infos, sous les actions : le bandeau tient son contenu en haut. */
const INFO_Y = ACTION.y + ACTION.size + 9;

/**
 * La mini-carte d'aperçu, en faux : la VIDÉO 16:9 en haut — l'image du titre
 * pendant l'agrandissement, puis des plans qui bougent —, le logo posé dessus,
 * le bouton du son en haut à droite ; dessous, le BANDEAU : les actions de la
 * carte (Lire, Ma liste, favori, vu), puis la ligne d'infos. Balisage
 * recopié de `components/cards/preview/` (que le client LG ne compile pas),
 * glyphes réels des cartes. Inerte : c'est la scène qui joue.
 */
export function FauxTrailerPreview({ trailer, shot, listed, transition, ...place }: FauxTrailerPreviewProps) {
  return (
    // Au-dessus des cartes de la rangée : leurs badges ont leur propre z-index.
    <Place {...place} w={PREVIEW_W} h={PREVIEW_H} transition={transition} style={{ zIndex: 15 }}>
      <div className="relative h-full w-full overflow-hidden rounded-[10px] bg-black shadow-[0_18px_40px_-12px_rgba(0,0,0,0.75)]">
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
          <div className="absolute inset-0" style={{ background: `linear-gradient(0deg, ${BAND_BG} 0%, rgba(20, 20, 25, 0) 42%)` }} />
          <div className="absolute bottom-1.5 left-2.5 max-w-[62%]">
            {trailer.logoUrl ? (
              <img src={trailer.logoUrl} alt="" draggable={false} className="block max-h-[22px] w-auto max-w-full object-contain object-left drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
            ) : (
              <p className="line-clamp-2 text-[11px] font-bold leading-tight text-white">{trailer.title}</p>
            )}
          </div>
          <span className="absolute right-1.5 top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-white/30 bg-black/50 text-white">
            <Volume2 className="h-2.5 w-2.5" aria-hidden />
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0" style={{ top: VIDEO_H, background: BAND_BG }}>
          <Actions listed={listed} />
          <p className="absolute left-[9px] right-[9px] truncate text-[9.5px] font-medium text-white/70" style={{ top: INFO_Y }}>
            {trailer.rating ? <span className="font-semibold text-white">★ {trailer.rating.toFixed(1)}</span> : null}
            {trailer.rating && trailer.meta ? " · " : null}
            {trailer.meta}
          </p>
        </div>
      </div>
    </Place>
  );
}

/** Les ronds du bandeau : « Lire » plein, puis Ma liste, favori, vu — l'ordre du plateau des cartes. */
function Actions({ listed }: { listed: boolean }) {
  const round = "absolute flex items-center justify-center rounded-full";
  const at = (index: number) => ({ left: ACTION.x + index * (ACTION.size + ACTION.gap), top: ACTION.y, width: ACTION.size, height: ACTION.size });
  return (
    <>
      <span className={`${round} bg-white text-black`} style={at(0)}>
        <PlayGlyph className="h-3 w-3" />
      </span>
      <span className={`${round} border border-white/40 text-white`} style={at(1)}>
        <Place x={0} y={0} w={ACTION.size - 2} h={ACTION.size - 2} className="flex items-center justify-center rounded-full bg-white/15" visible={listed} scale={listed ? 1 : 0.6} />
        <BookmarkGlyph className="relative h-3 w-3" filled={listed} />
      </span>
      <span className={`${round} border border-white/40 text-white`} style={at(2)}>
        <HeartGlyph className="h-3 w-3" filled={false} />
      </span>
      <span className={`${round} border border-white/40 text-white`} style={at(3)}>
        <WatchedGlyph className="h-3 w-3" filled={false} />
      </span>
    </>
  );
}
