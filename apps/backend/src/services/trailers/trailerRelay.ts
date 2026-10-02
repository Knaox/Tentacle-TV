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

import { Agent, fetch as undiciFetch } from "undici";
import { parseMaster, renderMaster, rewriteMedia, startVariant, type RelayMaster, type RelayMedia } from "./hlsPlaylists";
import { extractTrailerSource } from "./ytExtract";
import type { TrailerSource } from "./trailerSource";

/** Le jeton est posé au moment de servir : les textes gardés n'en portent que la place. */
export const TOKEN_SLOT = "{{t}}";

interface Entry {
  source: TrailerSource;
  validUntil: number;
  extractedAt: number;
  lastUsed: number;
  master?: RelayMaster;
  masterText?: string;
  media: Map<string, RelayMedia>;
}

/** Un trou de dix minutes avant l'échéance : une bande-annonce entamée doit pouvoir finir. */
const EXPIRY_MARGIN_MS = 10 * 60 * 1000;
/** Une extraction toute fraîche n'est pas refaite pour un refus : googlevideo bride, il n'a pas tout révoqué. */
const REFRESH_MIN_AGE_MS = 60 * 1000;
/** Quelques dizaines de vidéos suffisent (une soirée de fiches) ; chacune pèse moins de 100 Ko. */
const MAX_ENTRIES = 48;
/** Une vidéo absente pour de bon n'est pas redemandée avant une heure ; un raté passager, une minute. */
const PERMANENT_MISS_MS = 60 * 60 * 1000;
const TRANSIENT_MISS_MS = 60 * 1000;

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry | null>>();
const misses = new Map<string, number>();

/**
 * Connexions maintenues vers googlevideo : un segment ne repaie pas TCP + TLS
 * à chaque fois. Le `fetch` du paquet `undici`, pas le global : le `fetch` de
 * Node embarque sa propre version d'undici et refuse un `Agent` du paquet
 * (« fetch failed ») — même choix que le proxy Jellyfin.
 */
const upstreamDispatcher = new Agent({ keepAliveTimeout: 30_000, connections: 16, headersTimeout: 15_000 });

function evict(): void {
  if (entries.size <= MAX_ENTRIES) return;
  const oldest = [...entries.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  for (const [id] of oldest.slice(0, entries.size - MAX_ENTRIES)) entries.delete(id);
}

async function extract(ytId: string): Promise<Entry | null> {
  const started = Date.now();
  const result = await extractTrailerSource(ytId);
  if (!result.ok) {
    misses.set(ytId, Date.now() + (result.permanent ? PERMANENT_MISS_MS : TRANSIENT_MISS_MS));
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
  const entry: Entry = { source: result.source, validUntil: result.source.expiresAt - EXPIRY_MARGIN_MS, extractedAt: now, lastUsed: now, media: new Map() };
  entries.set(ytId, entry);
  evict();
  console.log(`[trailers] ${ytId} : ${result.source.kind} via ${result.clients.join(",")} en ${Date.now() - started} ms`);
  return entry;
}

/**
 * La vidéo résolue — en mémoire, en cours d'extraction, ou extraite ici.
 * `fresh` force une nouvelle extraction (URL refusée en cours de route).
 */
export function resolveEntry(ytId: string, { fresh = false } = {}): Promise<Entry | null> {
  const known = entries.get(ytId);
  const recent = known && Date.now() - known.extractedAt < REFRESH_MIN_AGE_MS;
  if (known && (!fresh || recent) && known.validUntil > Date.now()) {
    known.lastUsed = Date.now();
    return Promise.resolve(known);
  }
  const pending = inflight.get(ytId);
  if (pending) return pending;
  if (!fresh && (misses.get(ytId) ?? 0) > Date.now()) return Promise.resolve(null);
  if (fresh) entries.delete(ytId);
  const task = extract(ytId).finally(() => inflight.delete(ytId));
  inflight.set(ytId, task);
  return task;
}

/** L'état d'une vidéo pour qui la lance : son genre et l'échéance de ses URL. */
export async function resolveTrailer(ytId: string): Promise<{ kind: TrailerSource["kind"]; validUntil: number } | null> {
  const entry = await resolveEntry(ytId);
  return entry && { kind: entry.source.kind, validUntil: entry.validUntil };
}

/** Lit une ressource amont ; `refused` pour une URL que googlevideo ne sert plus. */
export async function fetchUpstream(url: string, headers: Record<string, string>, init: { signal?: AbortSignal; range?: string } = {}) {
  const res = await undiciFetch(url, {
    headers: { ...headers, ...(init.range ? { Range: init.range } : {}) },
    signal: init.signal ?? AbortSignal.timeout(15_000),
    dispatcher: upstreamDispatcher,
  });
  return { res, refused: res.status === 403 || res.status === 404 || res.status === 410 };
}

/**
 * Le MP4 progressif se laisse-t-il lire jusqu'au bout ? Le format 18 d'un
 * client sans jeton PO (`android_vr`) ne sert que son premier mégaoctet
 * (mesuré le 2026-10-01) : on demande ce que demande AVPlayer après ses deux
 * premiers octets — le fichier entier, par une plage ouverte —, et l'on n'en
 * lit que les en-têtes.
 */
export async function isReadable(url: string, headers: Record<string, string> = {}): Promise<boolean> {
  try {
    const { res } = await fetchUpstream(url, headers, { range: "bytes=0-", signal: AbortSignal.timeout(5_000) });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

async function loadMaster(entry: Entry): Promise<RelayMaster | null> {
  if (entry.master) return entry.master;
  if (entry.source.kind !== "hls") return null;
  const { res } = await fetchUpstream(entry.source.masterUrl, entry.source.headers);
  if (!res.ok) return null;
  const master = parseMaster(await res.text(), entry.source.masterUrl);
  if (!master) return null;
  entry.master = master;
  entry.masterText = renderMaster(master, (key) => `p/${key}.m3u8?t=${TOKEN_SLOT}`);
  return master;
}

/** Le maître relayé (gabarit à jeton), avec une reprise si l'URL amont est morte. */
export async function masterTemplate(ytId: string): Promise<string | null> {
  for (const fresh of [false, true]) {
    const entry = await resolveEntry(ytId, { fresh });
    if (!entry) return null;
    if (await loadMaster(entry)) return entry.masterText ?? null;
    if (entry.source.kind !== "hls") return null;
  }
  return null;
}

async function loadMedia(entry: Entry, key: string): Promise<RelayMedia | null> {
  const cached = entry.media.get(key);
  if (cached) return cached;
  const master = await loadMaster(entry);
  const upstream = master?.variants.find((v) => v.key === key)?.upstream ?? master?.audio.find((a) => a.key === key)?.upstream;
  if (!upstream || entry.source.kind !== "hls") return null;
  const { res } = await fetchUpstream(upstream, entry.source.headers);
  if (!res.ok) return null;
  const media = rewriteMedia(await res.text(), upstream, (i) => `../s/${key}/${i}.ts?t=${TOKEN_SLOT}`, () => `../s/${key}/init.mp4?t=${TOKEN_SLOT}`);
  if (media) entry.media.set(key, media);
  return media;
}

/** Une liste de segments relayée (gabarit à jeton), avec une reprise si l'URL amont est morte. */
export async function mediaTemplate(ytId: string, key: string): Promise<string | null> {
  for (const fresh of [false, true]) {
    const entry = await resolveEntry(ytId, { fresh });
    if (!entry) return null;
    const media = await loadMedia(entry, key);
    if (media) return media.text;
  }
  return null;
}

/** L'URL amont d'un segment (`index` ou `"init"`) et les en-têtes qui vont avec. */
export async function segmentTarget(ytId: string, key: string, index: number | "init", { fresh = false } = {}) {
  const entry = await resolveEntry(ytId, { fresh });
  if (!entry) return null;
  const media = await loadMedia(entry, key);
  const url = index === "init" ? media?.init : media?.segments[index];
  return url ? { url, headers: entry.source.headers } : null;
}

/** L'URL amont du MP4 progressif (repli des vidéos sans HLS). */
export async function progressiveTarget(ytId: string, { fresh = false } = {}) {
  const entry = await resolveEntry(ytId, { fresh });
  return entry?.source.kind === "progressive" ? { url: entry.source.url, headers: entry.source.headers } : null;
}

/**
 * Prépare une vidéo pour que son lancement soit immédiat : extraction, maître,
 * liste de la variante de départ et de son audio. Rien n'échoue bruyamment :
 * le lancement refera ce qui manque.
 */
export async function prepareTrailer(ytId: string): Promise<void> {
  const entry = await resolveEntry(ytId);
  if (!entry || entry.source.kind !== "hls") return;
  const master = await loadMaster(entry);
  if (!master) return;
  const start = startVariant(master.variants);
  const audio = master.audio.find((a) => a.group === start.audioGroup);
  await Promise.all([loadMedia(entry, start.key), audio ? loadMedia(entry, audio.key) : null]);
}

/** Pour les tests : repartir d'un relais vide. */
export function resetTrailerRelay(): void {
  entries.clear();
  inflight.clear();
  misses.clear();
}
