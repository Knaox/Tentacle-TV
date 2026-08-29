/**
 * La relecture PURE de `meta/<id>/segments.json` — testable sans DOM.
 *
 * Trois âges de fichier cohabitent sur les disques :
 *  1. le CONTRAT résolu v1 (meta v3) → relu tel quel ;
 *  2. l'ANCIEN format à trois payloads bruts (meta v2) → résolu ICI par la
 *     même fonction pure que le serveur (`resolvePlaybackSegments`) — aucune
 *     logique locale, et la réparation re-photographiera au prochain
 *     démarrage en ligne ;
 *  3. rien du tout (téléchargement très ancien) → résolution sur les seuls
 *     chapitres du DTO local.
 */

import {
  parsePlaybackSegmentsResponse,
  resolvePlaybackSegments,
  type ChapterMarker,
  type IntroSkipperDictPayload,
  type IntroSkipperTimestampsPayload,
  type MediaSegmentsPayload,
  type PlaybackSegmentsResponse,
} from "@tentacle-tv/shared";
import { TICKS_PER_SECOND, type MediaItem } from "@tentacle-tv/shared";

/** L'ancien `segments.json` : les trois sources brutes du snapshot v2. */
interface LegacySegmentsFile {
  mediaSegments?: unknown;
  pluginDict?: unknown;
  pluginTs?: unknown;
}

export function resolveLocalSegmentsPayload(
  raw: unknown,
  itemId: string,
  item: Pick<MediaItem, "RunTimeTicks" | "Chapters"> | undefined,
): PlaybackSegmentsResponse {
  // 1. Le contrat v1, tel quel.
  const contract = parsePlaybackSegmentsResponse(raw);
  if (contract !== null) return contract;

  // 2/3. Ancien format ou fichier absent : la même résolution que le serveur,
  // nourrie de ce que le disque sait (payloads bruts + chapitres du DTO).
  const legacy = (typeof raw === "object" && raw !== null ? raw : {}) as LegacySegmentsFile;
  const runtimeMs =
    typeof item?.RunTimeTicks === "number" && item.RunTimeTicks > 0
      ? Math.round(item.RunTimeTicks / (TICKS_PER_SECOND / 1000))
      : 0;

  return resolvePlaybackSegments(itemId, runtimeMs, {
    mediaSegments: (legacy.mediaSegments ?? null) as MediaSegmentsPayload | null,
    pluginDict: (legacy.pluginDict ?? null) as IntroSkipperDictPayload | null,
    pluginTimestamps: (legacy.pluginTs ?? null) as IntroSkipperTimestampsPayload | null,
    chapters: (item?.Chapters ?? null) as readonly ChapterMarker[] | null,
  });
}
