import { mpvStreamLost } from "@tentacle-tv/shared";
import { getProperty } from "../lib/mpvElectronApi";

interface CacheState {
  eof?: boolean;
  "cache-end"?: number;
}

/**
 * mpv (bureau) a-t-il perdu son flux pendant une panne de Jellyfin ? Lu au
 * retour de Jellyfin (`useOutageGate`) : l'état du cache de mpv
 * (`demuxer-cache-state`, rendu en JSON par la porte de la coquille) et sa
 * `duration`, même ligne de temps ; la règle est partagée (`mpvStreamLost`).
 * Mesuré : un transcodage HLS dont ffmpeg a sauté les segments pendant le
 * redémarrage finit son flux en avance — sans ce contrôle, mpv jouait sa
 * réserve puis sortait sur une fausse fin du film.
 */
export async function desktopStreamLost(transcoding: boolean): Promise<boolean> {
  try {
    const [raw, duration] = await Promise.all([
      getProperty("demuxer-cache-state", "string"),
      getProperty("duration", "double"),
    ]);
    const state = raw ? (JSON.parse(raw) as CacheState) : null;
    return mpvStreamLost({
      transcoding,
      cacheEof: typeof state?.eof === "boolean" ? state.eof : null,
      cacheEndS: typeof state?.["cache-end"] === "number" ? state["cache-end"] : null,
      durationS: duration,
    });
  } catch {
    return mpvStreamLost({ transcoding, cacheEof: null, cacheEndS: null, durationS: null });
  }
}
