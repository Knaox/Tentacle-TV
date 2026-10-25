/**
 * Octave — S3 du plan de R8 : la SUITE d'un clic dans les résultats d'une recherche est la radio de YouTube Music
 * du titre touché (`music.radio` de l'extension), plus les autres résultats — homonymes, reprises, versions piano
 * qu'il ne faut pas enchaîner (Damien, 25/10 : « je m'en fous du titre suivant »). Demandée APRÈS le premier son du
 * titre, jamais avant (L1 : rien ne dispute au titre touché son ouverture) ; album, playlist et artiste gardent
 * leur liste. Sans radio (extension d'avant, échec, liste vide) : la file d'avant, telle quelle.
 */

import { fetchExternalRadio, type MusicProvider } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { currentItem, queueActions, type OctavePlayer } from "@tentacle-tv/shared/octave";
import { isFromProvider } from "../mode/useOctaveProvider";

/** Les files nées d'une recherche (`search:<requête>`, son meilleur résultat, ses titres). */
const SEARCH_CONTEXT = /^search:/;

type RadioFetch = (provider: MusicProvider, externalId: string) => Promise<readonly MusicTrack[] | null>;

/** Suit le lecteur : au premier son d'un titre lancé depuis une recherche, sa radio devient la suite. */
export function followSearchWithRadio(player: OctavePlayer, provider: () => MusicProvider | null, fetchRadio: RadioFetch = fetchExternalRadio): () => void {
  let asked: string | null = null;
  return player.snapshot.subscribe(() => {
    const snap = player.snapshot.get();
    const item = currentItem(snap.queue);
    if (!item || snap.phase !== "playing" || asked === item.uid || !SEARCH_CONTEXT.test(snap.queue.contextId ?? "")) return;
    const p = provider();
    const external = item.track.external;
    if (!external || !isFromProvider(p, external.pluginId) || !p.music.radio) return;
    asked = item.uid;
    void fetchRadio(p, external.id).then((tracks) => {
      if (tracks && tracks.length > 0) queueActions.followWith(player, item.uid, tracks, `radio:${item.track.key}`);
    });
  });
}
