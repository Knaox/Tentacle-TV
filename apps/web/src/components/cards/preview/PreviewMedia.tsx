import { useLayoutEffect, useState, type SyntheticEvent } from "react";
import { useBrokenImage } from "../../../hooks/useBrokenImage";
import type { PreviewEngine } from "./engine";

interface PreviewMediaProps {
  engine: PreviewEngine;
  shown: boolean;
  /** Posée : l'agrandissement est fini, la vidéo joue. */
  settled: boolean;
  /** L'image 16:9 du titre (son fond, ou l'image même d'une vignette). */
  backdropUrl: string | null;
}

/**
 * Le média de la mini-carte : l'IMAGE du titre pendant l'agrandissement, puis
 * la vidéo qui la rejoint en fondu quand elle a sa première image ET que la
 * mini-carte est posée (`videoReady`, `settled`).
 *
 * Une bande-annonce s'ouvre presque toujours sur du noir ou un logo de
 * distributeur : grandir sur sa première image, c'était le plus souvent faire
 * grandir une boîte noire. L'image chargée et DÉCODÉE se signale au moteur
 * (`reportStillReady`) : la mini-carte peut alors se montrer sur elle sans
 * attendre la vidéo. Le choix se fait À LA RÉVÉLATION, et ne bouge plus : une
 * image arrivée trop tard (ou absente, ou cassée) laisse la vidéo seule —
 * jamais une vidéo déjà vue qui disparaîtrait sous une image.
 *
 * La vidéo reste RENDUE pendant le préchargement et l'attente (opacité nulle,
 * jamais `display: none`) : elle doit présenter sa première image. Son
 * letterbox incrusté est rogné par une échelle que le moteur mesure une fois
 * (`videoCrop`, posée en variable sur la scène — `previewSurface.css`).
 */
export function PreviewMedia({ engine, shown, settled, backdropUrl }: PreviewMediaProps) {
  const { broken, reportFailure } = useBrokenImage(backdropUrl);
  const [loaded, setLoaded] = useState(false);
  const [withImage, setWithImage] = useState<boolean | null>(null);
  const { reportStillReady, videoReady } = engine;

  // Avant la peinture de la première image vue : jamais un éclair de vidéo.
  useLayoutEffect(() => {
    if (shown && withImage === null) setWithImage(loaded && !broken);
  }, [shown, withImage, loaded, broken]);

  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true);
    // Décodée, elle se peint sans à-coup : le moteur peut révéler sur elle.
    e.currentTarget.decode().then(reportStillReady, () => undefined);
  };

  const waiting = withImage === true && !(videoReady && settled);
  return (
    <>
      {backdropUrl && !broken && (
        <img
          src={backdropUrl}
          alt=""
          aria-hidden
          draggable={false}
          decoding="async"
          onLoad={onLoad}
          onError={reportFailure}
          className="card-preview-backdrop"
        />
      )}
      {engine.renderVideo({ hold: !settled, className: waiting ? "card-preview-video is-waiting" : "card-preview-video" })}
    </>
  );
}
