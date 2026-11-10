/* ------------------------------------------------------------------ */
/*  Une vidéo tenue par le relais, et ce qui se lit chez l'amont       */
/*                                                                     */
/*  Ce que `trailerRelay.ts` garde pour chaque vidéo (sa source, ses   */
/*  listes lues, ses sous-titres convertis) et les lectures qui ne     */
/*  dépendent que d'ELLE : maître, maître réduit, liste de segments.   */
/*  Une lecture amont à la fois par ressource ; aucune extraction.     */
/* ------------------------------------------------------------------ */

import { titleLanguage } from "../reco/titleLanguage";
import { audioTagOf, chooseAudio, inventoryTags, type AudioChoice } from "./audioTracks";
import { OPUS_KEY, parseMaster, renderMaster, rewriteMedia, type RelayMaster, type RelayMedia } from "./hlsPlaylists";
import { loadOpusState, type OpusState } from "./open/openAudio";
import { chooseOpusTrack } from "./open/openSource";
import { fetchUpstream } from "./relayUpstream";
import { MIN_QUALITY_HEIGHT, type TrailerSource } from "./trailerSource";
import type { SubtitleCandidate } from "./trailerSubtitles";

/** Le jeton est posé au moment de servir : les textes gardés n'en portent que la place. */
export const TOKEN_SLOT = "{{t}}";

export interface Entry {
  source: TrailerSource;
  /**
   * L'entrée LIBRE de la vidéo (clé `o:<id>`, `videoRef.ts`) : son maître ne
   * garde que le VP9, son audio est l'Opus réemballé (`open/`). Absent : le
   * H.264 + AAC de toujours.
   */
  open?: true;
  /** La piste Opus d'une entrée libre, une fois sa tête lue (`open/openAudio.ts`). */
  opus?: OpusState;
  /** Les pistes de sous-titres offertes (trailerSubtitles.ts), relayées par trailerSubtitleRelay.ts. */
  subtitles: SubtitleCandidate[];
  /** Les WebVTT déjà convertis, par clé de piste. */
  subtitleTexts: Map<string, string>;
  validUntil: number;
  extractedAt: number;
  lastUsed: number;
  master?: RelayMaster;
  masterText?: string;
  /** Les maîtres réduits à une qualité (gabarits à jeton), par hauteur. */
  fixedMasters: Map<number, string>;
  media: Map<string, RelayMedia>;
  /** Les lectures amont en vol : deux demandes de la même liste en partagent une. */
  loading: Map<string, Promise<unknown>>;
}

export interface ResolvedTrailer {
  kind: TrailerSource["kind"];
  validUntil: number;
  /** Les qualités au choix (hauteurs H.264 du maître — VP9 pour une entrée libre) ; vide pour un MP4. */
  heights: number[];
  subtitles: SubtitleCandidate[];
  /**
   * La piste audio JOUÉE, quand la vidéo en a plusieurs : l'originale ou un
   * doublage humain — jamais un doublage automatique. Absente : une seule
   * piste, ou rien ne la dit (Dailymotion). C'est elle qui dit la vraie
   * version (VF, VO) de ce qu'on entend.
   */
  audio?: AudioChoice;
}

/**
 * Les qualités d'une vidéo HLS : celles que yt-dlp a vues, sinon celles du
 * maître lu (Dailymotion ne les dit que là) — hauteurs distinctes de 360p à
 * 1080p, la plus haute en tête.
 */
function heightsOf(entry: Entry): number[] {
  if (entry.source.kind !== "hls") return [];
  if (entry.open) return entry.source.open?.heights ?? [];
  if (entry.source.heights.length > 0) return entry.source.heights;
  const heights = new Set((entry.master?.variants ?? []).map((v) => v.height).filter((h) => h >= MIN_QUALITY_HEIGHT));
  return [...heights].sort((a, b) => b - a);
}

/** La langue qui choisit le doublage humain gardé : celle du serveur (métadonnées de Jellyfin). */
export const relayAudioLanguage = () => titleLanguage();

/**
 * La piste jouée : celle que le maître lu a retenue ; avant lui, celle que
 * l'inventaire de l'extraction promet (le maître applique la même règle) ;
 * pour un MP4, celle que son URL dit.
 */
export function playedAudio(entry: Entry): AudioChoice | undefined {
  if (entry.master) return entry.master.audioChoice ?? undefined;
  const { source } = entry;
  if (entry.open) return (openTrackOf(entry)?.choice ?? undefined) || undefined;
  if (source.kind === "progressive") {
    const tag = audioTagOf({ uri: source.url });
    if ((tag.content === "original" || tag.content === "dubbed") && tag.lang) return { content: tag.content, lang: tag.lang };
  }
  return chooseAudio(inventoryTags(source.audio), relayAudioLanguage()) ?? undefined;
}

/** La piste Opus d'une entrée libre et ce qu'elle est, ou `null` : la vidéo n'a pas de flux libre jouable. */
function openTrackOf(entry: Entry) {
  const { source } = entry;
  return source.kind === "hls" && source.open ? chooseOpusTrack(source.open, relayAudioLanguage(), source.audio) : null;
}

/** Une entrée libre dont l'extraction n'offre ni VP9 ni Opus jouable ne se sert pas : rien, plutôt que du H.264 illisible. */
export function servable(entry: Entry): boolean {
  return !entry.open || openTrackOf(entry) !== null;
}

export function resolvedOf(entry: Entry): ResolvedTrailer {
  const audio = playedAudio(entry);
  return { kind: entry.source.kind, validUntil: entry.validUntil, heights: heightsOf(entry), subtitles: entry.subtitles, ...(audio ? { audio } : {}) };
}

/** Une lecture amont à la fois par ressource ; une erreur de réseau vaut « rien ». */
function once<T>(entry: Entry, key: string, task: () => Promise<T | null>): Promise<T | null> {
  const pending = entry.loading.get(key) as Promise<T | null> | undefined;
  if (pending) return pending;
  const run = task().catch(() => null).finally(() => entry.loading.delete(key));
  entry.loading.set(key, run);
  return run;
}

/** Le maître de la vidéo, lu une fois ; `onLoaded` à sa première lecture. */
export function loadEntryMaster(entry: Entry, onLoaded: () => void = () => {}): Promise<RelayMaster | null> {
  if (entry.master) return Promise.resolve(entry.master);
  const source = entry.source;
  if (source.kind !== "hls") return Promise.resolve(null);
  return once(entry, "master", async () => {
    const { res } = await fetchUpstream(source.masterUrl, source.headers);
    if (!res.ok) return null;
    const open = entry.open ? openTrackOf(entry) : null;
    if (entry.open && !open) return null;
    // Les URI relatives se lisent depuis l'adresse FINALE (Dailymotion redirige parfois par `cdndirector`).
    const master = parseMaster(
      await res.text(), res.url || source.masterUrl, { serverLang: relayAudioLanguage(), inventory: source.audio },
      open ? { audioChoice: open.choice } : undefined,
    );
    if (!master) return null;
    entry.master = master;
    entry.masterText = renderMaster(master, (key) => `p/${key}.m3u8?t=${TOKEN_SLOT}`);
    onLoaded();
    return master;
  });
}

/** Le maître réduit à `height` (gabarit à jeton), gardé avec la vidéo. */
export function fixedMaster(entry: Entry, master: RelayMaster, height: number): string {
  let text = entry.fixedMasters.get(height);
  if (!text) {
    text = renderMaster(master, (key) => `p/${key}.m3u8?t=${TOKEN_SLOT}`, height);
    entry.fixedMasters.set(height, text);
  }
  return text;
}

/** Une liste de segments de la vidéo, lue une fois (son maître d'abord, s'il ne l'est pas). */
export function loadEntryMedia(entry: Entry, key: string, onMasterLoaded: () => void = () => {}): Promise<RelayMedia | null> {
  const cached = entry.media.get(key);
  if (cached) return Promise.resolve(cached);
  if (entry.open && key === OPUS_KEY) return loadOpusMedia(entry);
  return once(entry, `media:${key}`, async () => {
    const master = await loadEntryMaster(entry, onMasterLoaded);
    const upstream = master?.variants.find((v) => v.key === key)?.upstream ?? master?.audio.find((a) => a.key === key)?.upstream;
    if (!upstream || entry.source.kind !== "hls") return null;
    const { res } = await fetchUpstream(upstream, entry.source.headers);
    if (!res.ok) return null;
    // `../../../frag(1)/…` (Dailymotion) : relu depuis l'adresse finale, comme le maître.
    const media = rewriteMedia(await res.text(), res.url || upstream, (i) => `../s/${key}/${i}.ts?t=${TOKEN_SLOT}`, () => `../s/${key}/init.mp4?t=${TOKEN_SLOT}`);
    if (media) entry.media.set(key, media);
    return media;
  });
}


/**
 * La liste de la piste Opus d'une entrée libre : la tête du WebM lue une fois,
 * son index gardé avec la vidéo (`entry.opus`). `null` : la piste ne se lit
 * pas — l'entrée libre n'a alors rien à faire entendre, et n'est pas proposée.
 */
function loadOpusMedia(entry: Entry): Promise<RelayMedia | null> {
  return once(entry, `media:${OPUS_KEY}`, async () => {
    const open = openTrackOf(entry);
    if (!open) return null;
    const loaded = await loadOpusState(open.track, {
      segment: (i) => `../s/${OPUS_KEY}/${i}.ts?t=${TOKEN_SLOT}`, init: `../s/${OPUS_KEY}/init.mp4?t=${TOKEN_SLOT}`,
    });
    if (!("state" in loaded)) return null;
    entry.opus = loaded.state;
    entry.media.set(OPUS_KEY, loaded.state.media);
    return loaded.state.media;
  });
}
