/* ------------------------------------------------------------------ */
/*  Ce qu'une extraction offre à un lecteur SANS H.264 ni AAC          */
/*                                                                     */
/*  Le bureau CEF (Chromium sans codecs propriétaires) ne lit que le   */
/*  VP9 et l'Opus. Relevé le 2026-11-10 (yt-dlp 2026.10.21, client     */
/*  `visionos`, 48 formats d'une bande-annonce) :                      */
/*   - le maître HLS porte, à côté du H.264, des variantes VP9         */
/*     (`vp09.00.xx.08`, MP4 fragmenté) de 144p à 1080p — mais son     */
/*     audio n'est QUE de l'AAC (groupes 233 / 234) ;                  */
/*   - l'Opus existe en fichiers WebM à part (formats 249, 250, 251 ;  */
/*     48 à 125 kb/s), servis par plages, avec leurs variantes « DRC » */
/*     (dynamique compressée) et, sur une vidéo doublée, une piste par */
/*     langue marquée dans l'URL (`xtags=acont%3D…`).                  */
/*  D'où le flux « libre » : les variantes VP9 du maître, et UN Opus   */
/*  réemballé en piste audio (`webmOpus.ts`, `opusMp4.ts`). La règle   */
/*  des doublages est celle du H.264 (`audioTracks.ts`) : un doublage  */
/*  humain dans la langue du serveur, sinon l'originale — jamais une   */
/*  voix de synthèse. Module pur.                                      */
/* ------------------------------------------------------------------ */

import { audioTagOf, chooseAudio, inventoryTags, isUnplayableAudio, withInventory, type AudioChoice, type AudioInventory, type AudioTag } from "../audioTracks";

/** Les champs d'un format de `yt-dlp -j` lus ici (ceux de `YtFormat`, `trailerSource.ts`). */
interface Format {
  format_id?: string;
  protocol?: string;
  vcodec?: string | null;
  acodec?: string | null;
  height?: number | null;
  tbr?: number | null;
  url?: string;
  manifest_url?: string;
  http_headers?: Record<string, string>;
  format_note?: string | null;
}

/** Une piste Opus de YouTube : un WebM lu par plages. */
export interface OpusTrack {
  url: string;
  headers: Record<string, string>;
  /** kb/s — la plus riche de sa piste est gardée. */
  bitrate: number;
  /** Ce que YouTube dit de la piste (originale, doublage humain ou automatique, langue). */
  tag: AudioTag;
}

export interface OpenSource {
  /** Les hauteurs VP9 du maître, de la plus haute à la plus basse : les qualités au choix. */
  heights: number[];
  /** Une piste Opus par (contenu, langue), la plus riche ; jamais vide. */
  opus: OpusTrack[];
}

const isVp9 = (codec: string | null | undefined) => !!codec && /^vp0?9/i.test(codec);
const isOpus = (codec: string | null | undefined) => !!codec && /^opus/i.test(codec);
const isDrc = (f: Format) => /-drc$/i.test(f.format_id ?? "") || /\bDRC\b/i.test(f.format_note ?? "");
const tagKey = (tag: AudioTag) => `${tag.content}|${tag.lang ?? ""}`;

function headersOf(format: Format): Record<string, string> {
  const ua = format.http_headers?.["User-Agent"];
  return ua ? { "User-Agent": ua } : {};
}

/**
 * Le flux libre de cette extraction, ou `undefined` : il faut des variantes
 * VP9 dans `masterUrl` ET au moins une piste Opus jouable.
 */
export function pickOpenSource(formats: readonly Format[], masterUrl: string, bounds: { minHeight: number; maxHeight: number }): OpenSource | undefined {
  const heights = new Set<number>();
  for (const f of formats) {
    const h = f.height ?? 0;
    if (f.manifest_url === masterUrl && isVp9(f.vcodec) && h >= bounds.minHeight && h <= bounds.maxHeight) heights.add(h);
  }
  if (heights.size === 0) return undefined;
  const best = new Map<string, OpusTrack>();
  for (const f of formats) {
    if (f.protocol !== "https" || !f.url || !isOpus(f.acodec) || (f.vcodec && f.vcodec !== "none") || isDrc(f)) continue;
    const tag = audioTagOf({ uri: f.url });
    if (isUnplayableAudio(tag)) continue;
    const track: OpusTrack = { url: f.url, headers: headersOf(f), bitrate: f.tbr ?? 0, tag };
    const known = best.get(tagKey(tag));
    if (!known || track.bitrate > known.bitrate) best.set(tagKey(tag), track);
  }
  if (best.size === 0) return undefined;
  return { heights: [...heights].sort((a, b) => b - a), opus: [...best.values()] };
}

/**
 * La piste Opus à jouer et ce qu'elle est : un doublage humain dans la langue
 * du serveur, sinon l'originale (`chooseAudio`, la règle du H.264) ; rien de
 * marqué (une seule piste) : celle-là, sans rien en dire. `null` : aucune
 * piste jouable — jamais un doublage automatique à défaut.
 */
export function chooseOpusTrack(
  open: OpenSource, serverLang: string | null | undefined, inventory?: AudioInventory,
): { track: OpusTrack; choice: AudioChoice | null } | null {
  const tracks = open.opus.map((track) => ({ track, tag: withInventory(track.tag, inventory) })).filter((t) => !isUnplayableAudio(t.tag));
  if (tracks.length === 0) return null;
  const choice = chooseAudio([...tracks.map((t) => t.tag), ...inventoryTags(inventory)], serverLang);
  if (choice) {
    const chosen = tracks.find((t) => t.tag.content === choice.content && t.tag.lang === choice.lang);
    // La règle veut une piste (l'originale, un doublage) que l'Opus n'offre pas : rien, plutôt qu'une autre langue.
    return chosen ? { track: chosen.track, choice } : null;
  }
  // Rien n'est marqué : la vidéo n'a qu'une piste.
  const unmarked = tracks.filter((t) => t.tag.content === "unknown");
  return unmarked.length > 0 ? { track: unmarked[0].track, choice: null } : null;
}
