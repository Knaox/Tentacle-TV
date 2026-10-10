import { PipLoadingView, useLingeringLoading, type PipLoading } from "../../../pictureInPicture/PipLoadingView";
import { PipOverlay } from "../../../pictureInPicture/PipOverlay";
import { CARD_TONES } from "../FauxCard";
import { Place, type Animated, type Placed } from "../Place";

interface FauxPipProps extends Placed, Animated {
  /** Ce que la vidéo montre ; sans donnée, un dégradé de jetons. */
  image: string | null;
  title: string;
  /** 0..1. */
  progress?: number;
  /** Survolé : l'habillage du PiP paraît. */
  controls?: boolean;
  /** Une lecture se charge : la vraie vue de chargement couvre la vidéo. */
  loading?: PipLoading | null;
}

/** Le PiP est dessiné au double de sa taille de scène, puis réduit : ses pièces gardent leurs vraies proportions. */
const DRAWN = 2;
/** Le liseré presque noir et ses filets (`PipChrome`), l'ombre autour. */
const FRAME = "0 6px 14px -4px rgba(0, 0, 0, 0.5), 0 0 0 3px #0c0c0e, 0 0 0 4px rgba(0, 0, 0, 0.28)";
const noop = () => {};

/**
 * Le PiP du bureau, en faux : l'image, le liseré, et les VRAIES pièces de la
 * fenêtre — l'habillage du survol (`PipOverlay`) et la vue de chargement
 * (`PipLoadingView`, qui s'efface en fondu comme dans l'app). Rendu à la
 * taille d'un vrai PiP (~380 px), réduit de moitié : boutons et textes y ont
 * leurs proportions réelles.
 */
export function FauxPip({ image, title, progress = 0.3, controls = false, loading = null, w = 190, ...place }: FauxPipProps) {
  const h = Math.round((w * 9) / 16);
  const waiting = useLingeringLoading(loading);
  return (
    <Place {...place} w={w} h={h}>
      <div className="relative h-full w-full overflow-hidden rounded-[7px] bg-black" style={{ boxShadow: FRAME }}>
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: w * DRAWN, height: h * DRAWN, transform: `scale(${String(1 / DRAWN)})` }}
        >
          {image ? (
            <img src={image} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: CARD_TONES[1] }} />
          )}
          {waiting.shown !== null && <PipLoadingView loading={waiting.shown} leaving={waiting.leaving} />}
          <PipOverlay
            visible={controls} paused={false} position={progress * 3000} duration={3000} title={title}
            onTogglePause={noop} onSkip={noop} loading={loading !== null}
          />
        </div>
      </div>
    </Place>
  );
}
