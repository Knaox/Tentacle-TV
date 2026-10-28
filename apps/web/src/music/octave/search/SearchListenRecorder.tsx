/**
 * Octave — l'enregistreur du « déjà écouté » : monté une fois sous le lecteur
 * (`OctaveApp`), il note sur l'appareil chaque titre dont le PREMIER son est
 * sorti (pas un clic sans son, pas un préchargement), avec la recherche d'où
 * vient la file et l'album d'où il a été lancé (`searchListens.ts`). Une
 * écriture par titre, aucune requête, aucun rendu.
 */

import { useEffect } from "react";
import { recordSearchListensTo, type OctavePlayer } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "../player/OctavePlayerProvider";

/** Suit le lecteur ; rend sa désinscription (la règle est partagée avec le mobile). Exporté pour les tests. */
export function recordSearchListens(player: OctavePlayer, now: () => number = Date.now): () => void {
  return recordSearchListensTo(player, typeof localStorage === "undefined" ? null : localStorage, now);
}

export function SearchListenRecorder() {
  const player = useOctavePlayer();
  useEffect(() => recordSearchListens(player), [player]);
  return null;
}
