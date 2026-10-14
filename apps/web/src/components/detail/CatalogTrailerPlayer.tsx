import { useMemo } from "react";
import { trailerItemKey, trailerPlaybackKey, trailerQueueOf, type TrailerEntry } from "@tentacle-tv/shared";
import { TrailerPlayer } from "../trailerPlayer";

interface Props {
  /** Le catalogue, dans l'ordre du serveur. */
  entries: readonly TrailerEntry[];
  /** L'entrée choisie (le bouton, une tuile) ; la première sinon. */
  start?: TrailerEntry | null;
  /** La langue du serveur (catalogue), pour dire VF / VOSTFR / VO. */
  language: string | null;
  onClose: () => void;
}

/**
 * Le lecteur complet sur le CATALOGUE d'un titre : sa file est celle du
 * serveur (vidéos YouTube et Dailymotion, sans publicité), et il part de
 * l'entrée choisie ; à la fin, la suivante. Monté = ouvert.
 */
export function CatalogTrailerPlayer({ entries, start = null, language, onClose }: Props) {
  const queue = useMemo(() => trailerQueueOf(entries), [entries]);
  const startIndex = useMemo(() => {
    if (!start) return 0;
    const key = trailerPlaybackKey(start.playback);
    return Math.max(0, queue.findIndex((item) => trailerItemKey(item.playback) === key));
  }, [queue, start]);
  if (queue.length === 0) return null;
  return <TrailerPlayer queue={queue} startIndex={startIndex} language={language} onClose={onClose} />;
}
