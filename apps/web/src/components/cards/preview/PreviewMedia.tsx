import { useLayoutEffect, useState } from "react";
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
 * la vidéo qui la rejoint en fondu quand elle part (`settled`).
 *
 * Une bande-annonce s'ouvre presque toujours sur du noir ou un logo de
 * distributeur : grandir sur sa première image, c'était le plus souvent faire
 * grandir une boîte noire. Le choix se fait À LA RÉVÉLATION, et ne bouge plus :
 * une image arrivée trop tard (ou absente, ou cassée) laisse la vidéo seule —
 * jamais une vidéo déjà vue qui disparaîtrait sous une image.
 *
 * La vidéo reste RENDUE pendant le préchargement (opacité pleine, dans une
 * mini-carte encore transparente) : elle doit présenter sa première image.
 */
export function PreviewMedia({ engine, shown, settled, backdropUrl }: PreviewMediaProps) {
  const { broken, reportFailure } = useBrokenImage(backdropUrl);
  const [loaded, setLoaded] = useState(false);
  const [withImage, setWithImage] = useState<boolean | null>(null);

  // Avant la peinture de la première image vue : jamais un éclair de vidéo.
  useLayoutEffect(() => {
    if (shown && withImage === null) setWithImage(loaded && !broken);
  }, [shown, withImage, loaded, broken]);

  const waiting = withImage === true && !settled;
  return (
    <>
      {backdropUrl && !broken && (
        <img
          src={backdropUrl}
          alt=""
          aria-hidden
          draggable={false}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={reportFailure}
          className="card-preview-backdrop"
        />
      )}
      {engine.renderVideo({ hold: !settled, className: waiting ? "card-preview-video is-waiting" : "card-preview-video" })}
    </>
  );
}
