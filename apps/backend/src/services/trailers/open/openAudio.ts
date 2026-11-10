/* ------------------------------------------------------------------ */
/*  La piste Opus d'un maître libre, servie par le relais               */
/*                                                                     */
/*  L'Opus de YouTube est un WebM à part (`openSource.ts`). Ici : sa   */
/*  TÊTE lue une fois (64 Ko : l'index des grappes tient dans le       */
/*  premier Ko), la liste HLS qui en découle — une grappe de dix       */
/*  secondes par segment —, et chaque segment : sa plage d'octets lue  */
/*  chez googlevideo, réemballée en MP4 fragmenté (`webmOpus.ts`,      */
/*  `opusMp4.ts`). Aucune extraction ici : la source est celle de la   */
/*  vidéo que le relais tient.                                         */
/* ------------------------------------------------------------------ */

import { fetchUpstream } from "../relayUpstream";
import type { RelayMedia } from "../hlsPlaylists";
import { opusFragment, opusInitSegment } from "./opusMp4";
import type { OpusTrack } from "./openSource";
import { clusterPackets, parseOpusHead, type OpusIndex } from "./webmOpus";

/** La tête lue : bien plus que l'index d'une bande-annonce (quinze grappes : ~300 octets). */
const HEAD_BYTES = 64 * 1024;
/** Une grappe d'Opus à 125 kb/s pèse ~160 Ko ; au-delà de ceci, ce n'est pas ce qu'on attend. */
const MAX_SEGMENT_BYTES = 4 * 1024 * 1024;
export const OPUS_MIME = "audio/mp4";

/** Ce que le relais garde de la piste Opus d'une vidéo. */
export interface OpusState {
  track: OpusTrack;
  index: OpusIndex;
  init: Buffer;
  /** La liste HLS (gabarit à jeton), et les plages d'octets de ses segments. */
  media: RelayMedia;
}

export interface OpusSegment {
  body: Buffer;
  contentType: string;
}

/** La taille du fichier, d'après `Content-Range: bytes 0-65535/2243284`. */
function totalOf(contentRange: string | null): number | null {
  const total = Number(/\/(\d+)\s*$/.exec(contentRange ?? "")?.[1] ?? NaN);
  return Number.isFinite(total) && total > 0 ? total : null;
}

/** La liste HLS de la piste : un segment par grappe, MP4 fragmenté. */
export function opusPlaylist(index: OpusIndex, segmentUri: (i: number) => string, initUri: string): string {
  const durations = index.cues.map((cue, i) => Math.max(0.001, (index.cues[i + 1]?.timeS ?? index.durationS) - cue.timeS));
  const lines = [
    "#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-PLAYLIST-TYPE:VOD", `#EXT-X-TARGETDURATION:${Math.ceil(Math.max(...durations))}`,
    "#EXT-X-MEDIA-SEQUENCE:0", `#EXT-X-MAP:URI="${initUri}"`,
  ];
  durations.forEach((duration, i) => lines.push(`#EXTINF:${duration.toFixed(3)},`, segmentUri(i)));
  lines.push("#EXT-X-ENDLIST");
  return `${lines.join("\n")}\n`;
}

/**
 * Lit la tête de la piste et en tire l'état du relais. `null` : la piste ne se
 * lit pas (refus, pas un WebM Opus indexé) — le maître libre n'est alors pas
 * proposé. `uris` : les URI relayées de la liste (gabarit à jeton).
 */
export async function loadOpusState(
  track: OpusTrack, uris: { segment: (i: number) => string; init: string }, signal?: AbortSignal,
): Promise<{ state: OpusState } | { refused: boolean }> {
  const { res, refused } = await fetchUpstream(track.url, track.headers, { range: `bytes=0-${HEAD_BYTES - 1}`, ...(signal ? { signal } : {}) });
  if (!res.ok) {
    await res.body?.cancel();
    return { refused };
  }
  const head = new Uint8Array(await res.arrayBuffer());
  const index = parseOpusHead(head, totalOf(res.headers.get("content-range")) ?? head.length);
  if (!index) return { refused: false };
  const media: RelayMedia = { text: opusPlaylist(index, uris.segment, uris.init), segments: [] };
  return { state: { track, index, init: opusInitSegment(index.head), media } };
}

/** La plage d'octets du segment `i` (une grappe), bornes comprises ; `null` hors de la liste. */
export function opusSegmentRange(index: OpusIndex, i: number): { start: number; end: number } | null {
  const cue = index.cues[i];
  if (!cue) return null;
  return { start: cue.offset, end: (index.cues[i + 1]?.offset ?? index.totalSize) - 1 };
}

/**
 * Un segment de la piste : sa grappe lue chez googlevideo, réemballée.
 * `refused` : l'URL ne se sert plus (échéance, révocation) ; `null` : hors de
 * la liste, ou des octets qui ne sont pas la grappe attendue.
 */
export async function opusSegment(state: OpusState, i: number | "init", signal?: AbortSignal): Promise<OpusSegment | { refused: true } | null> {
  if (i === "init") return { body: state.init, contentType: OPUS_MIME };
  const range = opusSegmentRange(state.index, i);
  if (!range || range.end - range.start + 1 > MAX_SEGMENT_BYTES) return null;
  const { res, refused } = await fetchUpstream(state.track.url, state.track.headers, { range: `bytes=${range.start}-${range.end}`, ...(signal ? { signal } : {}) });
  if (!res.ok) {
    await res.body?.cancel();
    return refused ? { refused: true } : null;
  }
  const packets = clusterPackets(new Uint8Array(await res.arrayBuffer()), state.index);
  const body = packets ? opusFragment(packets, i + 1) : null;
  return body ? { body, contentType: OPUS_MIME } : null;
}
