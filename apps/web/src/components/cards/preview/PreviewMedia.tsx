import { useLayoutEffect, useState, type SyntheticEvent } from "react";
import { useBrokenImage } from "../../../hooks/useBrokenImage";
import type { PreviewEngine } from "./engine";

interface PreviewMediaProps {
  engine: PreviewEngine;
  /** La mini-carte paraît : la vidéo JOUE dès cet instant, agrandissement compris. */
  shown: boolean;
  /** L'image 16:9 du titre (son fond, ou l'image même d'une vignette). */
  backdropUrl: string | null;
}

/**
 * Le média de la mini-carte : la VIDÉO, qui joue dès que la mini-carte paraît
 * — elle grandit en mouvement, rien ne fige sa première image le temps de
 * l'agrandissement (attendre qu'elle soit posée, c'était 340 ms de plus avant
 * le premier mouvement). Si elle n'a pas encore sa première image quand la
 * mini-carte paraît, l'IMAGE du titre tient la place et la vidéo la rejoint
 * en fondu dès sa première image (`videoReady`).
 *
 * L'image chargée et DÉCODÉE se signale au moteur (`reportStillReady`) : la
 * mini-carte peut alors se montrer sur elle sans attendre la vidéo (une
 * bande-annonce vérifiée dont le flux coule déjà). Le choix se fait À LA
 * RÉVÉLATION, et ne bouge plus : une image arrivée trop tard (ou absente, ou
 * cassée), ou une vidéo déjà prête, laissent la vidéo seule — jamais une
 * vidéo déjà vue qui disparaîtrait sous une image.
 *
 * La vidéo reste RENDUE pendant le préchargement et l'attente (opacité nulle,
 * jamais `display: none`) : elle doit présenter sa première image. Son
 * letterbox incrusté est rogné par une échelle que le moteur mesure une fois
 * (`videoCrop`, posée en variable sur la scène — `previewSurface.css`).
 */
export function PreviewMedia({ engine, shown, backdropUrl }: PreviewMediaProps) {
  const { broken, reportFailure } = useBrokenImage(backdropUrl);
  const [loaded, setLoaded] = useState(false);
  const [withImage, setWithImage] = useState<boolean | null>(null);
  const { reportStillReady, videoReady } = engine;

  // Avant la peinture de la première image vue : jamais un éclair de vidéo — ni d'image sous une vidéo prête.
  useLayoutEffect(() => {
    if (shown && withImage === null) setWithImage(loaded && !broken && !videoReady);
  }, [shown, withImage, loaded, broken, videoReady]);

  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true);
    // Décodée, elle se peint sans à-coup : le moteur peut révéler sur elle.
    e.currentTarget.decode().then(reportStillReady, () => undefined);
  };

  const waiting = withImage === true && !videoReady;
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
      {engine.renderVideo({ hold: !shown, className: waiting ? "card-preview-video is-waiting" : "card-preview-video" })}
    </>
  );
}
