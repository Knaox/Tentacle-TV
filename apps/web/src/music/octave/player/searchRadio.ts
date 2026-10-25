/**
 * Octave — S3 du plan de R8 : la SUITE d'un clic dans les résultats d'une recherche est la radio de YouTube Music
 * du titre touché (`music.radio` de l'extension), plus les autres résultats — homonymes, reprises, versions piano
 * qu'il ne faut pas enchaîner (Damien, 25/10 : « je m'en fous du titre suivant »). Demandée APRÈS le premier son du
 * titre, jamais avant (L1 : rien ne dispute au titre touché son ouverture) ; album, playlist et artiste gardent
 * leur liste. Sans radio (extension d'avant, échec, liste vide) : la file d'avant, telle quelle.
 *
 * G3 (étude des clients de R5, d'après Metrolist) : cette radio est SANS FIN. Quand il ne reste plus que
 * `RADIO_REFILL_AT` titres à venir, sa page suivante (jeton `cursor`) s'ajoute au bout de la file, sans les titres
 * qu'elle porte déjà. Une demande en vol à la fois ; une panne, ou une page sans titre nouveau, attend le titre
 * suivant pour réessayer, et `RADIO_MISSES_MAX` de suite arrêtent la radio — jamais une boucle de requêtes.
 */

import { fetchExternalRadioPage, type MusicProvider } from "@tentacle-tv/api-client";
import type { ExternalMusicRadio } from "@tentacle-tv/shared/music";
import { currentItem, queueActions, upcoming, type OctavePlayer } from "@tentacle-tv/shared/octave";
import { isFromProvider } from "../mode/useOctaveProvider";

/** Les files nées d'une recherche (`search:<requête>`, son meilleur résultat, ses titres). */
const SEARCH_CONTEXT = /^search:/;

/** G3 : la page suivante se demande quand il ne reste plus que ce nombre de titres à venir. */
export const RADIO_REFILL_AT = 5;

/** G3 : pannes ou pages sans titre nouveau, d'affilée, avant d'arrêter la radio. */
export const RADIO_MISSES_MAX = 3;

type RadioPageFetch = (provider: MusicProvider, externalId: string, options: { cursor?: string }) => Promise<ExternalMusicRadio | null>;

/** La radio en cours : d'où elle vient, le jeton de sa page suivante, ce qui retient la prochaine demande. */
interface RadioRun {
  readonly pluginId: string;
  readonly contextId: string;
  readonly externalId: string;
  cursor: string | null;
  inFlight: boolean;
  misses: number;
  /** Après un échec : aucune nouvelle demande tant que ce titre reste le courant. */
  waitUid: string | null;
}

/** Suit le lecteur : au premier son d'un titre lancé depuis une recherche, sa radio devient la suite, sans fin. */
export function followSearchWithRadio(player: OctavePlayer, provider: () => MusicProvider | null, fetchPage: RadioPageFetch = fetchExternalRadioPage): () => void {
  let asked: string | null = null;
  let run: RadioRun | null = null;

  const refill = (): void => {
    const current = run;
    if (!current || current.inFlight || current.cursor === null) return;
    const queue = player.snapshot.get().queue;
    if (queue.contextId !== current.contextId) {
      run = null;
      return;
    }
    if (upcoming(queue).length > RADIO_REFILL_AT || currentItem(queue)?.uid === current.waitUid) return;
    const p = provider();
    if (!p?.music.radio || p.pluginId !== current.pluginId) return;
    const cursor = current.cursor;
    current.inFlight = true;
    void fetchPage(p, current.externalId, { cursor }).then((page) => {
      if (run !== current) return;
      // Toujours « en vol » pendant l'ajout : la file prévient ce module sur-le-champ, l'ancien jeton ne repart pas.
      const added = page ? queueActions.extendWith(player, current.contextId, page.tracks) : 0;
      if (added > 0) {
        current.misses = 0;
        current.waitUid = null;
        current.cursor = page?.cursor ?? null;
      } else {
        // Une panne garde son jeton ; une page qui ne redit que des titres connus passe à la suivante.
        current.misses += 1;
        current.waitUid = currentItem(player.snapshot.get().queue)?.uid ?? null;
        current.cursor = current.misses >= RADIO_MISSES_MAX ? null : page ? (page.cursor ?? null) : cursor;
      }
      current.inFlight = false;
      // Une page courte laisse encore la file près de sa fin : la suivante tout de suite.
      if (added > 0) refill();
    });
  };

  return player.snapshot.subscribe(() => {
    const snap = player.snapshot.get();
    const item = currentItem(snap.queue);
    if (item && snap.phase === "playing" && asked !== item.uid && SEARCH_CONTEXT.test(snap.queue.contextId ?? "")) {
      const p = provider();
      const external = item.track.external;
      if (external && isFromProvider(p, external.pluginId) && p.music.radio) {
        asked = item.uid;
        const contextId = `radio:${item.track.key}`;
        void fetchPage(p, external.id, {}).then((page) => {
          if (!page || page.tracks.length === 0) return;
          queueActions.followWith(player, item.uid, page.tracks, contextId);
          if (player.snapshot.get().queue.contextId !== contextId) return;
          run = { pluginId: p.pluginId, contextId, externalId: external.id, cursor: page.cursor ?? null, inFlight: false, misses: 0, waitUid: null };
          refill();
        });
        return;
      }
    }
    refill();
  });
}
