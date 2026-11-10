/**
 * Ouvre les bandes-annonces DISTANTES d'une fiche : le lecteur complet, sans
 * publicité (relais du serveur), quand le serveur sait le servir (capacité
 * `trailers.player`) et que ce build l'a (pas la dalle LG) ; sinon la modale
 * du lecteur officiel, comme avant. Mêmes propriétés que `TrailerModal` : le
 * bouton, la rangée des extras et le héros de la reco l'ouvrent pareil.
 *
 * Seules les vidéos YouTube entrent dans le lecteur complet ; une liste qui
 * n'en a aucune garde la modale (et son lien externe).
 */

import { useMemo } from "react";
import { useServerCapability, useTrailerDelivery } from "@tentacle-tv/api-client";
import { parseYouTubeId, type TrailerQueueItem } from "@tentacle-tv/shared";
import { TRAILER_PLAYER_AVAILABLE, TrailerPlayer } from "../trailerPlayer";
import { TrailerModal } from "./TrailerModal";

interface RemoteTrailer {
  Url: string;
  Name?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  trailers: RemoteTrailer[];
  initialIndex?: number;
}

/** La file du lecteur complet, et la place qu'y prend la bande-annonce cliquée. */
export function remoteTrailerQueue(trailers: readonly RemoteTrailer[], initialIndex = 0): { queue: TrailerQueueItem[]; start: number } {
  const queue: TrailerQueueItem[] = [];
  let start = 0;
  trailers.forEach((trailer, index) => {
    const ytId = parseYouTubeId(trailer.Url);
    if (!ytId) return;
    if (index === initialIndex) start = queue.length;
    queue.push({ playback: { kind: "youtube", ytId }, name: trailer.Name ?? "" });
  });
  return { queue, start };
}

/**
 * Le lecteur complet est-il celui de ces bandes-annonces ? Il lit le RELAIS :
 * un lecteur sans H.264 ni AAC (le bureau CEF) ne l'a que face à un serveur qui
 * sert le VP9 et l'Opus (`trailers.openCodecs`, `useTrailerDelivery`) ; sinon
 * la modale d'avant, et le lecteur officiel de YouTube — jamais un lecteur
 * complet qui échouerait sur chaque vidéo.
 */
export function useFullTrailerPlayer(): boolean {
  const capable = useServerCapability("trailers.player");
  const deliverable = useTrailerDelivery() !== null;
  return TRAILER_PLAYER_AVAILABLE && capable && deliverable;
}

export function TrailerViewer({ open, onClose, trailers, initialIndex = 0 }: Props) {
  const full = useFullTrailerPlayer();
  const { queue, start } = useMemo(() => remoteTrailerQueue(trailers, initialIndex), [trailers, initialIndex]);

  if (full && queue.length > 0) {
    return open ? <TrailerPlayer queue={queue} startIndex={start} onClose={onClose} /> : null;
  }
  return <TrailerModal open={open} onClose={onClose} trailers={trailers} initialIndex={initialIndex} />;
}
