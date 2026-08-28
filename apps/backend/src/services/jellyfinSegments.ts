/**
 * Les sources BRUTES des segments d'un média, récupérées chez Jellyfin.
 *
 * Ce service ne décide RIEN : il rapporte les payloads (API Media Segments,
 * greffon intro-skipper, chapitres + durée de l'item) et c'est le résolveur
 * partagé (`resolvePlaybackSegments`, @tentacle-tv/shared) qui tranche. Les
 * requêtes partent avec la CLÉ ADMIN : la route est déjà gardée par
 * `requireAuth`, ces données ne sont pas propres à un utilisateur, et la clé
 * garantit l'accès aux endpoints du greffon quel que soit le type de jeton
 * entrant (modèle du proxy pour les appareils jumelés).
 *
 * Cache mémoire par item, TTL court, conservation de la dernière valeur connue
 * quand Jellyfin ne répond plus (stale-on-error, comme jellyfinSystemConfig).
 */

import type { SegmentSources } from "../playback/resolveSegments";
import { TICKS_PER_MS } from "../playback/segmentTypes";
import { getJellyfinApiKey, getJellyfinUrl } from "./configStore";

const TTL_MS = 60_000;
const MAX_ENTRIES = 200;
const FETCH_TIMEOUT_MS = 8_000;

export interface SegmentSourceBundle {
  /** Durée du média en ms ; 0 quand l'item n'a pas pu être lu. */
  runtimeMs: number;
  sources: SegmentSources;
}

const EMPTY_BUNDLE: SegmentSourceBundle = { runtimeMs: 0, sources: {} };

interface CacheEntry {
  bundle: SegmentSourceBundle;
  expiresAt: number;
}

// Les entrées expirées restent en place : elles servent de repli stale-on-error.
const cache = new Map<string, CacheEntry>();

/** Pour les tests. */
export function clearSegmentSourceCache(): void {
  cache.clear();
}

async function fetchJson(url: string, apiKey: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { "X-Emby-Token": apiKey },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

interface ItemSnapshot {
  Type?: string;
  RunTimeTicks?: number;
  Chapters?: Array<{ StartPositionTicks?: number; Name?: string }>;
}

/** Une valeur du dictionnaire du greffon porte-t-elle une fin exploitable ? */
function dictUsable(dict: Record<string, { end?: number; End?: number } | undefined>): boolean {
  return Object.values(dict).some((v) => v && ((v.end ?? v.End ?? 0) > 0));
}

function chapterMarkers(item: ItemSnapshot): SegmentSources["chapters"] {
  const chapters = item.Chapters;
  if (!Array.isArray(chapters)) return null;
  return chapters
    .filter((c) => typeof c?.Name === "string" && typeof c?.StartPositionTicks === "number")
    .map((c) => ({ Name: c.Name as string, StartPositionTicks: c.StartPositionTicks as number }));
}

async function fetchBundle(itemId: string, url: string, apiKey: string): Promise<{
  bundle: SegmentSourceBundle;
  anySuccess: boolean;
}> {
  const [itemRaw, nativeRaw] = await Promise.all([
    fetchJson(`${url}/Items/${itemId}?fields=Chapters`, apiKey),
    fetchJson(`${url}/MediaSegments/${itemId}`, apiKey),
  ]);

  const item = (itemRaw ?? {}) as ItemSnapshot;
  const mediaSegments = nativeRaw as SegmentSources["mediaSegments"];
  const hasNative = Boolean(
    mediaSegments && Array.isArray(mediaSegments.Items) && mediaSegments.Items.length > 0,
  );

  // Les routes du greffon n'existent que pour les épisodes, et ne sont
  // interrogées que si l'API native n'a rien dit (économie de requêtes — la
  // priorité, elle, appartient au résolveur).
  let pluginDict: SegmentSources["pluginDict"] = null;
  let pluginTimestamps: SegmentSources["pluginTimestamps"] = null;
  if (!hasNative && item.Type === "Episode") {
    pluginDict = (await fetchJson(
      `${url}/Episode/${itemId}/IntroSkipperSegments`,
      apiKey,
    )) as SegmentSources["pluginDict"];
    if (!pluginDict || !dictUsable(pluginDict)) {
      pluginTimestamps = (await fetchJson(
        `${url}/Episode/${itemId}/Timestamps`,
        apiKey,
      )) as SegmentSources["pluginTimestamps"];
    }
  }

  const runTimeTicks = typeof item.RunTimeTicks === "number" ? item.RunTimeTicks : 0;
  return {
    bundle: {
      runtimeMs: runTimeTicks > 0 ? Math.round(runTimeTicks / TICKS_PER_MS) : 0,
      sources: {
        mediaSegments,
        pluginDict,
        pluginTimestamps,
        chapters: chapterMarkers(item),
      },
    },
    anySuccess: itemRaw !== null || nativeRaw !== null,
  };
}

export async function getSegmentSourceBundle(itemId: string): Promise<SegmentSourceBundle> {
  const entry = cache.get(itemId);
  if (entry && Date.now() < entry.expiresAt) return entry.bundle;

  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return entry?.bundle ?? EMPTY_BUNDLE;

  const { bundle, anySuccess } = await fetchBundle(itemId, url, apiKey);

  // Jellyfin entièrement muet : servir la dernière photo connue s'il y en a
  // une, sinon du vide SANS le mettre en cache (on retentera au prochain appel).
  if (!anySuccess) return entry?.bundle ?? EMPTY_BUNDLE;

  cache.set(itemId, { bundle, expiresAt: Date.now() + TTL_MS });
  if (cache.size > MAX_ENTRIES) {
    const doyen = cache.keys().next().value;
    if (doyen !== undefined) cache.delete(doyen);
  }
  return bundle;
}
