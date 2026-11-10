/* ------------------------------------------------------------------ */
/*  Le relais des bandes-annonces : résolutions, listes, reprises      */
/*                                                                     */
/*  Chaque vidéo est rangée sous sa CLÉ (`videoRef.ts`) : l'identifiant*/
/*  YouTube nu, ou `dm:<id>` pour Dailymotion (AlloCiné). Seule la     */
/*  résolution diffère — yt-dlp ou les métadonnées de Dailymotion ;    */
/*  listes, segments, jetons et reprises sont les mêmes.               */
/*                                                                     */
/*  Une vidéo résolue reste en mémoire jusqu'à l'échéance de ses URL   */
/*  googlevideo (~6 h) : la relancer, ou la préparer à l'ouverture de  */
/*  la fiche, ne coûte plus d'extraction. Deux demandes simultanées    */
/*  partagent la même extraction. Une URL que googlevideo refuse en    */
/*  cours de route (échéance, révocation) déclenche UNE nouvelle       */
/*  extraction, transparente pour le téléviseur.                       */
/* ------------------------------------------------------------------ */

import type { RelayMaster, RelayMedia } from "./hlsPlaylists";
import { evictEntries } from "./relayEviction";
import { fetchUpstream, isReadable } from "./relayUpstream";
import { extractTrailerSource, type ExtractionOptions, type ExtractionResult } from "./ytExtract";
import { extractDailymotionSource } from "./dailymotionSource";
import type { TrailerSource } from "./trailerSource";
import { parseVideoRef } from "./videoRef";
import type { SubtitleCandidate } from "./trailerSubtitles";
import { loadEntryMaster, loadEntryMedia, playedAudio, resolvedOf, servable, TOKEN_SLOT, type Entry, type ResolvedTrailer } from "./relayEntry";
import type { AudioChoice } from "./audioTracks";

export { fetchUpstream, isReadable, resolvedOf, TOKEN_SLOT };
// Ce que les routes lisent d'une vidéo résolue (maître, listes, segments, reprises) : `relayTargets.ts`.
export { masterTemplate, mediaTemplate, opusSegmentOf, progressiveTarget, relayAttempts, segmentTarget } from "./relayTargets";
export type { Entry, ResolvedTrailer };

/** Un trou de dix minutes avant l'échéance : une bande-annonce entamée doit pouvoir finir. */
const EXPIRY_MARGIN_MS = 10 * 60 * 1000;
/** Une extraction toute fraîche n'est pas refaite pour un refus : googlevideo bride, il n'a pas tout révoqué. */
const REFRESH_MIN_AGE_MS = 60 * 1000;
/**
 * Les vidéos COMPLÈTES (listes lues, quelques dizaines de Ko, cent au plus)
 * gardées : une soirée de fiches, et les aperçus que la préparation tient
 * prêts pour les titres à l'écran — quelques écrans de cartes. Au-delà, les
 * plus anciennes ne gardent que leur source — quelques Ko —, jusqu'à son
 * échéance : un aperçu qui revient sur un titre ne coûte jamais une nouvelle
 * extraction YouTube tant que ses URL valent (`relayEviction.ts`).
 */
const MAX_ENTRIES = 160;
const MAX_SOURCES = 1_000;
/**
 * Une vidéo absente pour de bon n'est pas redemandée avant une heure ; un
 * raté passager, quinze secondes (le temps d'éviter une rafale). Un délai
 * épuisé n'est pas retenu du tout : le prochain geste réessaie — l'ancien
 * « échec retenu dix minutes » faisait échouer aussitôt chaque relance.
 */
const PERMANENT_MISS_MS = 60 * 60 * 1000;
const TRANSIENT_MISS_MS = 15 * 1000;

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry | null>>();
const misses = new Map<string, number>();

const evict = () => evictEntries(entries, Date.now(), { full: MAX_ENTRIES, total: MAX_SOURCES });

/**
 * La source d'une vidéo : yt-dlp pour YouTube, les métadonnées du lecteur pour
 * Dailymotion — à sa cadence de préparation quand personne n'attend encore.
 */
function extractSource(key: string, options: ExtractionOptions): Promise<ExtractionResult> {
  const ref = parseVideoRef(key);
  if (!ref) return Promise.resolve({ ok: false, permanent: true, timedOut: false, reason: "référence inconnue" });
  return ref.kind === "dailymotion"
    ? extractDailymotionSource(ref.id, options.background ? "prefetch" : "interactive")
    : extractTrailerSource(ref.id, options);
}

/** L'entrée d'une vidéo fraîchement résolue (ou reprise) : libre si sa clé le dit (`o:<id>`). */
function newEntry(ref: string, source: TrailerSource, subtitles: SubtitleCandidate[], validUntil: number, extractedAt: number, lastUsed = extractedAt): Entry {
  const open = parseVideoRef(ref)?.kind === "youtube" && (parseVideoRef(ref) as { open?: true }).open === true;
  return {
    source, subtitles, subtitleTexts: new Map(), fixedMasters: new Map(), validUntil, extractedAt, lastUsed,
    media: new Map(), loading: new Map(), ...(open ? { open: true as const } : {}),
  };
}

/**
 * L'AUTRE entrée de la même vidéo YouTube (H.264 ↔ libre), si le relais la
 * tient : une extraction dit les deux flux à la fois (`trailerSource.ts`),
 * elle n'est jamais refaite pour passer de l'un à l'autre.
 */
function siblingOf(ref: string): Entry | null {
  const video = parseVideoRef(ref);
  if (video?.kind !== "youtube") return null;
  const sibling = entries.get(video.open ? video.id : `o:${video.id}`);
  return sibling && sibling.validUntil > Date.now() ? sibling : null;
}

/** Une vidéo sans flux libre (ni VP9 ni Opus jouable) : son entrée libre n'existe pas — retenu une heure. */
function refuseUnservable(ref: string, entry: Entry): Entry | null {
  if (servable(entry)) return entry;
  misses.set(ref, Date.now() + PERMANENT_MISS_MS);
  console.warn(`[trailers] ${ref} : aucun flux VP9 + Opus pour cette vidéo`);
  return null;
}

async function extract(ref: string, options: ExtractionOptions): Promise<Entry | null> {
  const started = Date.now();
  const result = await extractSource(ref, options);
  // Rien demandé à YouTube (aperçu suspendu, budget de l'heure) : rien à retenir contre la vidéo.
  if (!result.ok && result.skipped) return null;
  if (!result.ok) {
    if (!result.timedOut) misses.set(ref, Date.now() + (result.permanent ? PERMANENT_MISS_MS : TRANSIENT_MISS_MS));
    if (misses.size > 500) for (const [id, until] of misses) if (until <= Date.now()) misses.delete(id);
    console.warn(`[trailers] ${ref} : aucun flux (${result.reason})`);
    return null;
  }
  if (result.source.kind === "progressive" && !(await isReadable(result.source.url, result.source.headers))) {
    misses.set(ref, Date.now() + TRANSIENT_MISS_MS);
    console.warn(`[trailers] ${ref} : MP4 refusé par googlevideo au-delà de son début (via ${result.clients.join(",")})`);
    return null;
  }
  misses.delete(ref);
  const now = Date.now();
  const entry = refuseUnservable(ref, newEntry(ref, result.source, result.subtitles, result.source.expiresAt - EXPIRY_MARGIN_MS, now));
  if (!entry) {
    // Pas de flux libre, mais l'extraction est faite : elle sert l'entrée H.264 de la même vidéo,
    // qu'un autre client n'aura pas à redemander à YouTube.
    const video = parseVideoRef(ref);
    if (video?.kind === "youtube" && video.open && !entries.has(video.id)) {
      entries.set(video.id, newEntry(video.id, result.source, result.subtitles, result.source.expiresAt - EXPIRY_MARGIN_MS, now));
      evict();
      relayChanged();
    }
    return null;
  }
  entries.set(ref, entry);
  evict();
  relayChanged();
  console.log(`[trailers] ${ref} : ${result.source.kind} via ${result.clients.join(",")} en ${Date.now() - started} ms`);
  return entry;
}

/**
 * La vidéo résolue — en mémoire, en cours d'extraction, ou extraite ici.
 * `fresh` force une nouvelle extraction (URL refusée en cours de route) ;
 * `priority` et `budgetMs` ne valent que pour une extraction qui commence ici
 * (un aperçu au survol passe après les lectures, cf. `extractionSlots.ts`).
 * `heldOnly` : la vidéo que le relais TIENT, ou rien — jamais d'extraction.
 */
export function resolveEntry(
  ref: string,
  { fresh = false, heldOnly = false, ...extraction }: { fresh?: boolean; heldOnly?: boolean } & ExtractionOptions = {},
): Promise<Entry | null> {
  const known = heldEntry(ref);
  if (heldOnly) {
    if (!known || known.validUntil <= Date.now()) return Promise.resolve(null);
    known.lastUsed = Date.now();
    return Promise.resolve(known);
  }
  const recent = known && Date.now() - known.extractedAt < REFRESH_MIN_AGE_MS;
  if (known && (!fresh || recent) && known.validUntil > Date.now()) {
    known.lastUsed = Date.now();
    return Promise.resolve(known);
  }
  const pending = inflight.get(ref);
  if (pending) return pending;
  if (!fresh && (misses.get(ref) ?? 0) > Date.now()) return Promise.resolve(null);
  if (fresh) entries.delete(ref);
  const task = extract(ref, extraction).finally(() => inflight.delete(ref));
  inflight.set(ref, task);
  return task;
}

/** Le maître d'une vidéo, lu une fois ; lu, elle pèse ses listes : le relais fait de la place. */
export function loadMaster(entry: Entry): Promise<RelayMaster | null> {
  return loadEntryMaster(entry, evict);
}

/** Une liste de segments, lue une fois ; le maître lu en chemin fait aussi de la place. */
export function loadMedia(entry: Entry, key: string): Promise<RelayMedia | null> {
  return loadEntryMedia(entry, key, evict);
}

/**
 * L'état d'une vidéo pour qui la lance : son genre, l'échéance de ses URL, ses
 * qualités et ses pistes. Une source HLS qui ne dit pas ses hauteurs
 * (Dailymotion) fait lire son maître d'abord : il les donne, et un maître
 * illisible rend la vidéo indisponible au lieu d'un lecteur qui échoue.
 */
export async function resolveTrailer(
  key: string,
  extraction: ExtractionOptions & { fresh?: boolean; heldOnly?: boolean } = {},
): Promise<ResolvedTrailer | null> {
  const entry = await resolveEntry(key, extraction);
  if (!entry) return null;
  if (entry.source.kind === "hls" && entry.source.heights.length === 0 && !(await loadMaster(entry))) return null;
  return resolvedOf(entry);
}

/**
 * La piste que le relais JOUE pour cette vidéo, s'il la tient encore — sans
 * extraction ni lecture amont. Le catalogue en corrige la version promise
 * (`catalogBuild.ts`) : une « VF » doublée par IA y redevient une VO.
 */
export function heldAudio(ref: string): AudioChoice | undefined {
  const entry = entries.get(ref);
  return entry && entry.validUntil > Date.now() ? playedAudio(entry) : undefined;
}

/**
 * La vidéo telle que le relais la tient, sans extraction ni lecture amont
 * (`trailerPrepare.ts`). L'AUTRE entrée de la même vidéo YouTube (H.264 ↔
 * libre) suffit : sa source dit les deux flux, celle-ci en naît sur place.
 */
export function heldEntry(ref: string): Entry | undefined {
  const known = entries.get(ref);
  if (known) return known;
  const sibling = siblingOf(ref);
  if (!sibling || (misses.get(ref) ?? 0) > Date.now()) return undefined;
  const shared = refuseUnservable(ref, newEntry(ref, sibling.source, sibling.subtitles, sibling.validUntil, sibling.extractedAt, Date.now()));
  if (!shared) return undefined;
  entries.set(ref, shared);
  evict();
  relayChanged();
  return shared;
}

/** Ce qu'une vidéo résolue garde d'un redémarrage : sa SOURCE seule (`previewMemoryStore.ts`). */
export interface HeldSource {
  ytId: string;
  source: TrailerSource;
  subtitles: SubtitleCandidate[];
  validUntil: number;
  extractedAt: number;
}

let onChange: (() => void) | null = null;
const relayChanged = () => onChange?.();

/** Prévient `listener` à chaque nouvelle extraction (la mémoire durable s'écrit alors). */
export function onRelaySourcesChange(listener: (() => void) | null): void {
  onChange = listener;
}

/**
 * Les sources YouTube encore valables, pour la mémoire durable. Celles de
 * Dailymotion n'y vont pas : relues en une requête, sans extraction, elles ne
 * valent pas d'être gardées d'un redémarrage.
 */
export function heldSources(now = Date.now()): HeldSource[] {
  return [...entries]
    .filter(([key, e]) => e.validUntil > now && parseVideoRef(key)?.kind === "youtube")
    .map(([ytId, e]) => ({ ytId, source: e.source, subtitles: e.subtitles, validUntil: e.validUntil, extractedAt: e.extractedAt }));
}

/** Reprend des sources d'avant un redémarrage : listes à relire chez googlevideo, AUCUNE extraction. */
export function restoreSources(list: readonly HeldSource[], now = Date.now()): void {
  for (const held of list) {
    if (held.validUntil <= now || entries.has(held.ytId)) continue;
    entries.set(held.ytId, newEntry(held.ytId, held.source, held.subtitles, held.validUntil, held.extractedAt));
  }
  evict();
}

/** Pour les tests : repartir d'un relais vide. */
export function resetTrailerRelay(): void {
  entries.clear();
  inflight.clear();
  misses.clear();
}
