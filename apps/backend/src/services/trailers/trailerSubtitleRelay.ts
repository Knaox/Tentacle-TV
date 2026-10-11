/* ------------------------------------------------------------------ */
/*  Le relais des sous-titres d'une bande-annonce                      */
/*                                                                     */
/*  Le téléviseur ne lit jamais une URL YouTube : il demande au serveur*/
/*  la piste choisie (`/api/trailers/subs/…`, même jeton que le flux), */
/*  que le serveur relit chez YouTube (`api/timedtext`) et rend en     */
/*  WebVTT propre (timedText.ts). Une piste lue est gardée avec la     */
/*  vidéo ; une URL refusée en cours de route déclenche UNE nouvelle   */
/*  extraction, comme pour le flux.                                    */
/* ------------------------------------------------------------------ */

import { fetchUpstream, resolveEntry, type Entry } from "./trailerRelay";
import { toWebVtt } from "./timedText";

/** Une piste de bande-annonce pèse quelques dizaines de Ko : au-delà, ce n'en est pas une. */
const MAX_TRACK_BYTES = 2 * 1024 * 1024;

type Load = { vtt: string | null; refused: boolean };

async function loadTrack(entry: Entry, key: string): Promise<Load> {
  const track = entry.subtitles.find((s) => s.key === key);
  if (!track) return { vtt: null, refused: false };
  const { res, refused } = await fetchUpstream(track.url, entry.source.headers);
  if (!res.ok) {
    await res.body?.cancel();
    return { vtt: null, refused };
  }
  const body = await res.text();
  const vtt = body.length <= MAX_TRACK_BYTES ? toWebVtt(body, track.format) : null;
  if (vtt) entry.subtitleTexts.set(key, vtt);
  return { vtt, refused: false };
}

/** Une lecture amont à la fois par piste : deux demandes simultanées en partagent une. */
function loadOnce(entry: Entry, key: string): Promise<Load> {
  const slot = `subs:${key}`;
  const pending = entry.loading.get(slot) as Promise<Load> | undefined;
  if (pending) return pending;
  const run = loadTrack(entry, key)
    .catch((): Load => ({ vtt: null, refused: false }))
    .finally(() => entry.loading.delete(slot));
  entry.loading.set(slot, run);
  return run;
}

/** Le WebVTT de la piste `key` de `ytId`, ou `null` (piste inconnue, illisible, vidéo perdue). */
export async function subtitleVtt(ytId: string, key: string): Promise<string | null> {
  for (const fresh of [false, true]) {
    const entry = await resolveEntry(ytId, { fresh });
    if (!entry) return null;
    const cached = entry.subtitleTexts.get(key);
    if (cached) return cached;
    const { vtt, refused } = await loadOnce(entry, key);
    if (vtt || !refused) return vtt;
  }
  return null;
}
