/**
 * Les deux formats du greffon intro-skipper — l'avant-Media Segments.
 *
 * Extrait de `resolveSegments.ts` : ce sont deux routes d'un greffon historique,
 * consultées seulement quand l'API native de Jellyfin n'a rien dit, et elles
 * n'ont aucune règle en commun avec le reste du résolveur. Aucune décision n'a
 * changé en chemin — la PRIORITÉ entre sources reste chez l'appelant.
 *
 * MIROIR : reflété octet pour octet dans `apps/backend/src/playback/` (voir
 * l'en-tête de `segmentTypes.ts`) — n'importer que la paire.
 */

import type { SegmentType } from "./segmentTypes";
import type { BoundsByType, RawBounds } from "./segmentChapters";

/** Bornes du greffon intro-skipper, en SECONDES, casse variable. */
export interface IntroSkipperBounds {
  start?: number;
  end?: number;
  Start?: number;
  End?: number;
}

/** Greffon : GET /Episode/{id}/IntroSkipperSegments (dictionnaire). */
export interface IntroSkipperDictPayload {
  [key: string]: IntroSkipperBounds | undefined;
}

/** Greffon : GET /Episode/{id}/Timestamps (propriétés nommées). */
export interface IntroSkipperTimestampsPayload {
  introduction?: IntroSkipperBounds;
  credits?: IntroSkipperBounds;
  recap?: IntroSkipperBounds;
  preview?: IntroSkipperBounds;
  commercial?: IntroSkipperBounds;
}

function pluginBoundsToMs(bounds: IntroSkipperBounds | undefined): RawBounds | null {
  if (!bounds) return null;
  const start = bounds.start ?? bounds.Start ?? 0;
  const end = bounds.end ?? bounds.End ?? 0;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= 0) return null;
  return { startMs: start * 1000, endMs: end * 1000, source: "jellyfin" };
}

const DICT_KEYS: ReadonlyArray<readonly [SegmentType, string, string]> = [
  ["Intro", "Introduction", "introduction"],
  ["Outro", "Credits", "credits"],
  ["Recap", "Recap", "recap"],
  ["Preview", "Preview", "preview"],
  ["Commercial", "Commercial", "commercial"],
];

export function collectDict(payload: IntroSkipperDictPayload | null | undefined): BoundsByType | null {
  if (!payload) return null;
  const bounds: BoundsByType = new Map();
  for (const [type, pascal, camel] of DICT_KEYS) {
    const ms = pluginBoundsToMs(payload[pascal] ?? payload[camel]);
    if (ms) bounds.set(type, [ms]);
  }
  return bounds.size > 0 ? bounds : null;
}

export function collectTimestamps(
  payload: IntroSkipperTimestampsPayload | null | undefined,
): BoundsByType | null {
  if (!payload) return null;
  const fields: ReadonlyArray<readonly [SegmentType, IntroSkipperBounds | undefined]> = [
    ["Intro", payload.introduction],
    ["Outro", payload.credits],
    ["Recap", payload.recap],
    ["Preview", payload.preview],
    ["Commercial", payload.commercial],
  ];
  const bounds: BoundsByType = new Map();
  for (const [type, raw] of fields) {
    const ms = pluginBoundsToMs(raw);
    if (ms) bounds.set(type, [ms]);
  }
  return bounds.size > 0 ? bounds : null;
}
