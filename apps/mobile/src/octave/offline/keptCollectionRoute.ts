/**
 * Octave (mobile) — où s'ouvre une collection de « Sur cet appareil » (lot « ol », 01/11), règle pure
 * (`keptCollectionRoute.test.ts`). Une playlist de la bibliothèque (ou « Titres likés ») dont la page est gardée
 * dans le cache d'Octave s'ouvre SUR SA PAGE : son dernier ordre en ligne, le tri et l'ordre personnalisé du
 * compte, le glisser (envoyé au retour du réseau) — la playlist en ligne, en version hors ligne, comme le bureau.
 * Sans page gardée, un album, une playlist d'ailleurs : la collection gardée, dans « Sur cet appareil ».
 */

import { octavePaths } from "@tentacle-tv/shared/octave/mode";

export function keptCollectionRoute(key: string, pageKept: (target: { kind: "playlist"; id: string } | { kind: "liked" }) => boolean): string {
  if (key === "playlist:liked" && pageKept({ kind: "liked" })) return octavePaths.liked;
  if (key.startsWith("playlist:jf:")) {
    const id = key.slice("playlist:jf:".length);
    if (pageKept({ kind: "playlist", id })) return octavePaths.playlist(id);
  }
  return `${octavePaths.device}?c=${encodeURIComponent(key)}`;
}
