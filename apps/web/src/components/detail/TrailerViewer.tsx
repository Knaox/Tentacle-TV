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
import { useServerCapability } from "@tentacle-tv/api-client";
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

/** Le lecteur complet est-il celui de ces bandes-annonces ? */
export function useFullTrailerPlayer(): boolean {
  const capable = useServerCapability("trailers.player");
  return TRAILER_PLAYER_AVAILABLE && capable;
}

export function TrailerViewer({ open, onClose, trailers, initialIndex = 0 }: Props) {
  const full = useFullTrailerPlayer();
  const { queue, start } = useMemo(() => remoteTrailerQueue(trailers, initialIndex), [trailers, initialIndex]);

  if (full && queue.length > 0) {
    return open ? <TrailerPlayer queue={queue} startIndex={start} onClose={onClose} /> : null;
  }
  return <TrailerModal open={open} onClose={onClose} trailers={trailers} initialIndex={initialIndex} />;
}
