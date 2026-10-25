/**
 * Octave — l'enregistreur du « déjà écouté » : monté une fois sous le lecteur
 * (`OctaveApp`), il note sur l'appareil chaque titre dont le PREMIER son est
 * sorti (pas un clic sans son, pas un préchargement), avec la recherche d'où
 * vient la file et l'album d'où il a été lancé (`searchListens.ts`). Une
 * écriture par titre, aucune requête, aucun rendu.
 */

import { useEffect } from "react";
import { currentItem, type OctavePlayer } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { albumTargetOf, queryOfContext, readSearchListens, withListen, writeSearchListens } from "./searchListens";

/** Suit le lecteur ; rend sa désinscription. Exporté pour les tests. */
export function recordSearchListens(player: OctavePlayer, now: () => number = Date.now): () => void {
  let noted: string | null = null;
  return player.snapshot.subscribe(() => {
    const snap = player.snapshot.get();
    const item = currentItem(snap.queue);
    if (!item || snap.phase !== "playing" || item.uid === noted) return;
    noted = item.uid;
    const contextId = snap.queue.contextId;
    writeSearchListens(
      withListen(readSearchListens(), {
        track: item.track,
        query: queryOfContext(contextId),
        albumTarget: albumTargetOf(item.track, contextId),
        at: now(),
      }),
    );
  });
}

export function SearchListenRecorder() {
  const player = useOctavePlayer();
  useEffect(() => recordSearchListens(player), [player]);
  return null;
}
