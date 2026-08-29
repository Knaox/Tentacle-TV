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
 *
 * ⚠️ `GET /Items/{id}` EXIGE un `userId` — sans lui, Jellyfin 10.11 répond 400.
 * Ce détail a coûté cher : la requête échouait pour TOUS les médias, `fetchJson`
 * rendait `null`, et le paquet partait avec `runtimeMs = 0` et zéro chapitre.
 * Or le résolveur lit `runtimeMs` pour décider s'il reste quelque chose après
 * le générique (`hasContentAfter`) : à zéro, un Outro vaut toujours « rien
 * après », donc « passer le générique » d'un film valait « terminer le film »
 * — la scène post-générique était perdue, sur chaque film. Le repli par
 * chapitres et les replis greffon (qui testent `Type === "Episode"`) n'ont,
 * eux, jamais tourné. D'où le journal ci-dessous : un item illisible ne doit
 * plus jamais passer en silence.
 */

import type { SegmentSources } from "../playback/resolveSegments";
import type { TrickplayManifest } from "./trickplayFrames";
import { TICKS_PER_MS } from "../playback/segmentTypes";
import { getConfigValue, getJellyfinApiKey, getJellyfinUrl } from "./configStore";

const TTL_MS = 60_000;
const MAX_ENTRIES = 200;
const FETCH_TIMEOUT_MS = 8_000;

export interface SegmentSourceBundle {
  /** Durée du média en ms ; 0 quand l'item n'a pas pu être lu. */
  runtimeMs: number;
  /** Bibliothèque racine du média, `null` si elle n'a pas pu être établie. */
  libraryId: string | null;
  /**
   * Les vignettes disponibles pour ce média, telles que Jellyfin les publie.
   *
   * Elles ne sont PAS une source de segments : c'est de la matière brute, que
   * seule l'analyse de secours va lire (`frameAnalysis.ts`), et seulement quand
   * les fournisseurs n'ont rien de crédible à dire.
   */
  trickplay: TrickplayManifest | null;
  sources: SegmentSources;
}

const EMPTY_BUNDLE: SegmentSourceBundle = { runtimeMs: 0, libraryId: null, trickplay: null, sources: {} };

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
  Trickplay?: TrickplayManifest;
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

/**
 * La bibliothèque RACINE d'un média — l'ancêtre `CollectionFolder`.
 *
 * Jellyfin empile saison, série, dossier ; un seul ancêtre porte ce type, et
 * c'est celui que l'utilisateur voit dans son menu. Aucune heuristique de
 * chemin : c'est le serveur qui le dit.
 */
function collectionFolderId(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const o = entry as { Type?: unknown; Id?: unknown };
    if (o.Type === "CollectionFolder" && typeof o.Id === "string") return o.Id;
  }
  return null;
}

/** Même besoin de `userId` que l'item : sans lui, la route rend 400. */
function ancestorsUrl(url: string, itemId: string): string {
  const adminId = getConfigValue("admin_jellyfin_id");
  const user = adminId ? `?userId=${encodeURIComponent(adminId)}` : "";
  return `${url}/Items/${itemId}/Ancestors${user}`;
}

/**
 * L'URL de l'item, avec le `userId` sans lequel Jellyfin 10.11 rend 400.
 * L'identifiant de l'administrateur est déjà en base (`admin_jellyfin_id`,
 * posé par l'assistant de configuration) ; à défaut on tente quand même la
 * forme nue, qui répondait sur les serveurs plus anciens.
 */
function itemUrl(url: string, itemId: string): string {
  const adminId = getConfigValue("admin_jellyfin_id");
  const user = adminId ? `userId=${encodeURIComponent(adminId)}&` : "";
  return `${url}/Items/${itemId}?${user}fields=Chapters,Trickplay`;
}

async function fetchBundle(itemId: string, url: string, apiKey: string): Promise<{
  bundle: SegmentSourceBundle;
  anySuccess: boolean;
}> {
  const [itemRaw, nativeRaw, ancestorsRaw] = await Promise.all([
    fetchJson(itemUrl(url, itemId), apiKey),
    fetchJson(`${url}/MediaSegments/${itemId}`, apiKey),
    fetchJson(ancestorsUrl(url, itemId), apiKey),
  ]);

  if (itemRaw === null) {
    // Sans l'item, pas de durée ni de chapitres : le contrat sera bancal et le
    // dire vaut mieux que de rendre un Outro qui termine un film par surprise.
    console.warn(`[segments] item ${itemId} illisible chez Jellyfin — durée et chapitres perdus`);
  }
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
      libraryId: collectionFolderId(ancestorsRaw),
      trickplay: item.Trickplay ?? null,
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
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return bundle;
}
