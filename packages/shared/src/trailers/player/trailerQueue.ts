/**
 * La FILE du lecteur complet des bandes-annonces (web, bureau) : ce qu'il
 * sait lire, comment il le demande au serveur, ce qui vient après, et ce
 * qu'il dit de chacune. Module pur.
 *
 * Le lecteur ne lit que des vidéos en ligne, TOUJOURS par le relais du
 * serveur — zéro publicité. Une bande-annonce LOCALE (Jellyfin) part vers le
 * lecteur habituel, jamais ici. Le lecteur officiel de YouTube n'est qu'un
 * REPLI, quand le serveur ne peut pas extraire (`409 { fallback: "embed" }`,
 * capacité `trailers.catalog`) ou que la lecture échoue ; Dailymotion n'en a
 * pas (son lecteur insère des publicités) : on passe à la suivante.
 */

import type { TrailerAudio, TrailerEntry, TrailerPlayback, TrailerScope, TrailerSource, TrailerVersion } from "../trailerCatalog";
import { playedTrailerVersion } from "../trailerCatalogRank";
import { parseYouTubeId } from "../trailerList";

/** Une vidéo que le relais sait lire. */
export type RelayedTrailerPlayback = Extract<TrailerPlayback, { kind: "youtube" } | { kind: "dailymotion" }>;

/** Une bande-annonce dans la file : sa vidéo, et ce que la liste en dit (facultatif hors catalogue). */
export interface TrailerQueueItem {
  playback: RelayedTrailerPlayback;
  name: string;
  version?: TrailerVersion;
  scope?: TrailerScope;
  source?: TrailerSource;
}

export const isRelayedPlayback = (playback: TrailerPlayback): playback is RelayedTrailerPlayback =>
  playback.kind === "youtube" || playback.kind === "dailymotion";

/** Les entrées du catalogue que le lecteur lit, dans l'ordre du serveur. */
export function trailerQueueOf(entries: readonly TrailerEntry[]): TrailerQueueItem[] {
  return entries.flatMap((entry) => (isRelayedPlayback(entry.playback)
    ? [{ playback: entry.playback, name: entry.name, version: entry.version, scope: entry.scope, source: entry.source }]
    : []));
}

/** L'identité d'une vidéo dans la file (clé React, mémoire). */
export function trailerItemKey(playback: RelayedTrailerPlayback): string {
  return playback.kind === "youtube" ? `yt:${playback.ytId}` : `dm:${playback.videoId}`;
}

/** Les paramètres de `/resolve` et `/prepare` : `ytId=…` ou `dmId=…`. */
export function trailerResolveQuery(playback: RelayedTrailerPlayback): string {
  return playback.kind === "youtube" ? `ytId=${encodeURIComponent(playback.ytId)}` : `dmId=${encodeURIComponent(playback.videoId)}`;
}

/** Le corps de `/report` : la première image (et son délai), ou l'échec et sa raison. */
export function trailerReportBody(playback: RelayedTrailerPlayback, outcome: { ok: boolean; ms: number; reason?: string }) {
  const id = playback.kind === "youtube" ? { ytId: playback.ytId } : { dmId: playback.videoId };
  const ms = Math.max(0, Math.min(10 * 60_000, Math.round(outcome.ms)));
  return { ...id, ok: outcome.ok, ms, ...(outcome.reason ? { reason: outcome.reason.slice(0, 200) } : {}) };
}

/** Le refus de `/resolve` qui demande le lecteur officiel : `409 { fallback: "embed" }`. */
export function isEmbedFallback(status: number, body: unknown): boolean {
  return status === 409 && typeof body === "object" && body !== null && (body as { fallback?: unknown }).fallback === "embed";
}

/**
 * Après un échec, dans l'ordre du plan :
 * - le serveur dit qu'il ne peut pas extraire YouTube maintenant (`embed`,
 *   budget ou blocage) : le lecteur OFFICIEL, pour CETTE bande-annonce — des
 *   publicités peuvent y paraître, une ligne le dit ;
 * - une lecture qui échoue (indisponible, chien de garde) : la SUIVANTE ;
 * - au bout de la file, le lecteur officiel si c'est YouTube, sinon on ferme
 *   (Dailymotion n'a pas de repli : son lecteur insère des publicités).
 */
export function trailerFailureStep(
  playback: RelayedTrailerPlayback,
  position: { index: number; count: number },
  cause: "embed" | "failed",
): "embed" | "next" | "close" {
  if (cause === "embed" && playback.kind === "youtube") return "embed";
  if (position.index + 1 < position.count) return "next";
  return playback.kind === "youtube" ? "embed" : "close";
}

/** La voisine dans la file (`+1` suivante, `-1` précédente), sans boucler ; `null` au bout. */
export function trailerNeighborIndex(index: number, count: number, direction: 1 | -1): number | null {
  const next = index + direction;
  return next >= 0 && next < count ? next : null;
}

/**
 * Le libellé de version, en clé i18n (`common:trailerVersion_<clé>`) : VF,
 * VOSTFR, VO pour un serveur français — les mots de l'interface ailleurs.
 * `null` : rien de sûr à dire (`unknown`).
 */
export function trailerVersionLabelKey(version: TrailerVersion | undefined, language: string | null | undefined): string | null {
  if (!version || version === "unknown") return null;
  const french = !!language && language.toLowerCase().split(/[-_]/)[0] === "fr";
  if (french) return version === "localized" ? "vf" : version === "subtitled" ? "vostfr" : "vo";
  return version;
}

/**
 * L'élément tel qu'on l'ENTEND : sa version corrigée par la piste que le
 * serveur joue (`audio` de `/resolve`) — une « VF » que YouTube doublait par
 * IA, dont le serveur ne relaie que l'originale, se dit VO, et appelle ses
 * sous-titres. Sans piste connue (flux pas encore résolu, une seule piste,
 * serveur d'avant) : l'élément tel quel. `language` : celle qui a décidé des
 * versions (le catalogue), celle du flux à défaut.
 */
export function heardTrailerItem<T extends Pick<TrailerQueueItem, "version">>(
  item: T, stream: { audio?: TrailerAudio; language?: string } | null | undefined, language: string | null | undefined,
): T {
  if (!item.version || !stream?.audio) return item;
  const version = playedTrailerVersion(item.version, stream.audio, language ?? stream.language);
  return version === item.version ? item : { ...item, version };
}

/** D'où vient la vidéo, pour la liste : AlloCiné, ou la plateforme qui la sert. */
export function trailerOriginLabel(item: Pick<TrailerQueueItem, "playback" | "source">): "allocine" | "youtube" | "dailymotion" {
  if (item.source === "allocine") return "allocine";
  return item.playback.kind;
}

/** L'adresse publique d'une vidéo, pour « Ouvrir sur YouTube / Dailymotion ». */
export function trailerPublicUrl(playback: RelayedTrailerPlayback): string {
  return playback.kind === "youtube"
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(playback.ytId)}`
    : `https://www.dailymotion.com/video/${encodeURIComponent(playback.videoId)}`;
}

const DAILYMOTION_URL = /dailymotion\.com\/(?:video|embed\/video)\/([A-Za-z0-9]+)/;

/**
 * La vidéo d'une adresse publique (YouTube ou Dailymotion), l'inverse de
 * `trailerPublicUrl` : l'écran de bande-annonce des téléviseurs ne reçoit
 * qu'une adresse, et une entrée du catalogue (AlloCiné) y passe par elle.
 */
export function relayedPlaybackOfUrl(url: string | undefined): RelayedTrailerPlayback | null {
  const ytId = parseYouTubeId(url);
  if (ytId) return { kind: "youtube", ytId };
  const dm = url?.match(DAILYMOTION_URL);
  return dm ? { kind: "dailymotion", videoId: dm[1] } : null;
}
