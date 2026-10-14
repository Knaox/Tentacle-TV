/* ------------------------------------------------------------------ */
/*  Le relais des bandes-annonces : résolutions, listes, reprises      */
/*                                                                     */
/*  Une vidéo résolue reste en mémoire jusqu'à l'échéance de ses URL   */
/*  googlevideo (~6 h) : la relancer, ou la préparer à l'ouverture de  */
/*  la fiche, ne coûte plus d'extraction. Deux demandes simultanées    */
/*  partagent la même extraction. Une URL que googlevideo refuse en    */
/*  cours de route (échéance, révocation) déclenche UNE nouvelle       */
/*  extraction, transparente pour le téléviseur.                       */
/* ------------------------------------------------------------------ */

import { parseMaster, renderMaster, rewriteMedia, type RelayMaster, type RelayMedia } from "./hlsPlaylists";
import { evictEntries } from "./relayEviction";
import { fetchUpstream, isReadable } from "./relayUpstream";
import { extractTrailerSource, type ExtractionOptions } from "./ytExtract";
import type { RelayScope } from "./relayToken";
import type { TrailerSource } from "./trailerSource";
import type { SubtitleCandidate } from "./trailerSubtitles";

export { fetchUpstream, isReadable };

/** Le jeton est posé au moment de servir : les textes gardés n'en portent que la place. */
export const TOKEN_SLOT = "{{t}}";

export interface Entry {
  source: TrailerSource;
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

/** Un trou de dix minutes avant l'échéance : une bande-annonce entamée doit pouvoir finir. */
const EXPIRY_MARGIN_MS = 10 * 60 * 1000;
/** Une extraction toute fraîche n'est pas refaite pour un refus : googlevideo bride, il n'a pas tout révoqué. */
const REFRESH_MIN_AGE_MS = 60 * 1000;
/**
 * Quelques dizaines de vidéos COMPLÈTES (listes lues, moins de 100 Ko
 * chacune) suffisent à une soirée de fiches. Au-delà, les plus anciennes ne
 * gardent que leur source — quelques Ko —, jusqu'à son échéance : un aperçu
 * qui revient sur un titre ne coûte jamais une nouvelle extraction YouTube
 * tant que ses URL valent (`relayEviction.ts`).
 */
const MAX_ENTRIES = 96;
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

async function extract(ytId: string, options: ExtractionOptions): Promise<Entry | null> {
  const started = Date.now();
  const result = await extractTrailerSource(ytId, options);
  // Rien demandé à YouTube (aperçu suspendu, budget de l'heure) : rien à retenir contre la vidéo.
  if (!result.ok && result.skipped) return null;
  if (!result.ok) {
    if (!result.timedOut) misses.set(ytId, Date.now() + (result.permanent ? PERMANENT_MISS_MS : TRANSIENT_MISS_MS));
    if (misses.size > 500) for (const [id, until] of misses) if (until <= Date.now()) misses.delete(id);
    console.warn(`[trailers] ${ytId} : aucun flux (${result.reason})`);
    return null;
  }
  if (result.source.kind === "progressive" && !(await isReadable(result.source.url, result.source.headers))) {
    misses.set(ytId, Date.now() + TRANSIENT_MISS_MS);
    console.warn(`[trailers] ${ytId} : MP4 refusé par googlevideo au-delà de son début (via ${result.clients.join(",")})`);
    return null;
  }
  misses.delete(ytId);
  const now = Date.now();
  const entry: Entry = {
    source: result.source, subtitles: result.subtitles, subtitleTexts: new Map(), fixedMasters: new Map(),
    validUntil: result.source.expiresAt - EXPIRY_MARGIN_MS, extractedAt: now, lastUsed: now, media: new Map(), loading: new Map(),
  };
  entries.set(ytId, entry);
  evict();
  relayChanged();
  console.log(`[trailers] ${ytId} : ${result.source.kind} via ${result.clients.join(",")} en ${Date.now() - started} ms`);
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
  ytId: string,
  { fresh = false, heldOnly = false, ...extraction }: { fresh?: boolean; heldOnly?: boolean } & ExtractionOptions = {},
): Promise<Entry | null> {
  const known = entries.get(ytId);
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
  const pending = inflight.get(ytId);
  if (pending) return pending;
  if (!fresh && (misses.get(ytId) ?? 0) > Date.now()) return Promise.resolve(null);
  if (fresh) entries.delete(ytId);
  const task = extract(ytId, extraction).finally(() => inflight.delete(ytId));
  inflight.set(ytId, task);
  return task;
}

export interface ResolvedTrailer {
  kind: TrailerSource["kind"];
  validUntil: number;
  /** Les qualités au choix (hauteurs H.264 du maître) ; vide pour un MP4. */
  heights: number[];
  subtitles: SubtitleCandidate[];
}

export function resolvedOf(entry: Entry): ResolvedTrailer {
  const heights = entry.source.kind === "hls" ? entry.source.heights : [];
  return { kind: entry.source.kind, validUntil: entry.validUntil, heights, subtitles: entry.subtitles };
}

/** L'état d'une vidéo pour qui la lance : son genre, l'échéance de ses URL, ses qualités et ses pistes. */
export async function resolveTrailer(ytId: string, extraction: ExtractionOptions & { fresh?: boolean } = {}): Promise<ResolvedTrailer | null> {
  const entry = await resolveEntry(ytId, extraction);
  return entry ? resolvedOf(entry) : null;
}

/** La vidéo telle que le relais la tient, sans extraction ni lecture amont (`trailerPrepare.ts`). */
export function heldEntry(ytId: string): Entry | undefined {
  return entries.get(ytId);
}

/** Une lecture amont à la fois par ressource ; une erreur de réseau vaut « rien ». */
function once<T>(entry: Entry, key: string, task: () => Promise<T | null>): Promise<T | null> {
  const pending = entry.loading.get(key) as Promise<T | null> | undefined;
  if (pending) return pending;
  const run = task().catch(() => null).finally(() => entry.loading.delete(key));
  entry.loading.set(key, run);
  return run;
}

export function loadMaster(entry: Entry): Promise<RelayMaster | null> {
  if (entry.master) return Promise.resolve(entry.master);
  const source = entry.source;
  if (source.kind !== "hls") return Promise.resolve(null);
  return once(entry, "master", async () => {
    const { res } = await fetchUpstream(source.masterUrl, source.headers);
    if (!res.ok) return null;
    const master = parseMaster(await res.text(), source.masterUrl);
    if (!master) return null;
    entry.master = master;
    entry.masterText = renderMaster(master, (key) => `p/${key}.m3u8?t=${TOKEN_SLOT}`);
    evict();
    return master;
  });
}

/** Le maître réduit à `height` (gabarit à jeton), gardé avec la vidéo. */
function fixedMaster(entry: Entry, master: RelayMaster, height: number): string {
  let text = entry.fixedMasters.get(height);
  if (!text) {
    text = renderMaster(master, (key) => `p/${key}.m3u8?t=${TOKEN_SLOT}`, height);
    entry.fixedMasters.set(height, text);
  }
  return text;
}

/**
 * Les essais d'une lecture amont pour un jeton de cette portée : une lecture
 * (`/resolve`) en a deux — le second après une nouvelle extraction, si
 * googlevideo refuse l'URL ; un aperçu, un seul, sur la vidéo que le relais
 * tient (`relayToken.ts`) : l'oubliée se redemande à `/preview`, gardé.
 */
export function relayAttempts(scope: RelayScope): Array<{ fresh: boolean; heldOnly: boolean }> {
  return scope === "preview" ? [{ fresh: false, heldOnly: true }] : [{ fresh: false, heldOnly: false }, { fresh: true, heldOnly: false }];
}

/**
 * Le maître relayé (gabarit à jeton), avec une reprise si l'URL amont est
 * morte. Avec `height`, le maître réduit à cette qualité.
 */
export async function masterTemplate(ytId: string, height?: number, scope: RelayScope = "play"): Promise<string | null> {
  for (const attempt of relayAttempts(scope)) {
    const entry = await resolveEntry(ytId, attempt);
    if (!entry) return null;
    const master = await loadMaster(entry);
    if (master) return height ? fixedMaster(entry, master, height) : entry.masterText ?? null;
    if (entry.source.kind !== "hls") return null;
  }
  return null;
}

export function loadMedia(entry: Entry, key: string): Promise<RelayMedia | null> {
  const cached = entry.media.get(key);
  if (cached) return Promise.resolve(cached);
  return once(entry, `media:${key}`, async () => {
    const master = await loadMaster(entry);
    const upstream = master?.variants.find((v) => v.key === key)?.upstream ?? master?.audio.find((a) => a.key === key)?.upstream;
    if (!upstream || entry.source.kind !== "hls") return null;
    const { res } = await fetchUpstream(upstream, entry.source.headers);
    if (!res.ok) return null;
    const media = rewriteMedia(await res.text(), upstream, (i) => `../s/${key}/${i}.ts?t=${TOKEN_SLOT}`, () => `../s/${key}/init.mp4?t=${TOKEN_SLOT}`);
    if (media) entry.media.set(key, media);
    return media;
  });
}

/** Une liste de segments relayée (gabarit à jeton), avec une reprise si l'URL amont est morte. */
export async function mediaTemplate(ytId: string, key: string, scope: RelayScope = "play"): Promise<string | null> {
  for (const attempt of relayAttempts(scope)) {
    const entry = await resolveEntry(ytId, attempt);
    if (!entry) return null;
    const media = await loadMedia(entry, key);
    if (media) return media.text;
  }
  return null;
}

/** L'URL amont d'un segment (`index` ou `"init"`) et les en-têtes qui vont avec. */
export async function segmentTarget(ytId: string, key: string, index: number | "init", attempt: { fresh?: boolean; heldOnly?: boolean } = {}) {
  const entry = await resolveEntry(ytId, attempt);
  if (!entry) return null;
  const media = await loadMedia(entry, key);
  const url = index === "init" ? media?.init : media?.segments[index];
  return url ? { url, headers: entry.source.headers } : null;
}

/** L'URL amont du MP4 progressif (repli des vidéos sans HLS). */
export async function progressiveTarget(ytId: string, attempt: { fresh?: boolean; heldOnly?: boolean } = {}) {
  const entry = await resolveEntry(ytId, attempt);
  return entry?.source.kind === "progressive" ? { url: entry.source.url, headers: entry.source.headers } : null;
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

/** Les sources encore valables, pour la mémoire durable. */
export function heldSources(now = Date.now()): HeldSource[] {
  return [...entries]
    .filter(([, e]) => e.validUntil > now)
    .map(([ytId, e]) => ({ ytId, source: e.source, subtitles: e.subtitles, validUntil: e.validUntil, extractedAt: e.extractedAt }));
}

/** Reprend des sources d'avant un redémarrage : listes à relire chez googlevideo, AUCUNE extraction. */
export function restoreSources(list: readonly HeldSource[], now = Date.now()): void {
  for (const held of list) {
    if (held.validUntil <= now || entries.has(held.ytId)) continue;
    entries.set(held.ytId, {
      source: held.source, subtitles: held.subtitles, subtitleTexts: new Map(), fixedMasters: new Map(),
      validUntil: held.validUntil, extractedAt: held.extractedAt, lastUsed: held.extractedAt, media: new Map(), loading: new Map(),
    });
  }
  evict();
}

/** Pour les tests : repartir d'un relais vide. */
export function resetTrailerRelay(): void {
  entries.clear();
  inflight.clear();
  misses.clear();
}
