/**
 * LA résolution des segments de lecture — une fonction pure, une seule.
 *
 * Deux appelants, jamais plus : le backend (`GET /api/playback/segments/:id`,
 * qui interroge Jellyfin puis résout) et la lecture locale du bureau (ancien
 * `segments.json` au format brut, résolu au moment de lire). C'est ce qui
 * garantit qu'aucune plateforme ne recalcule sa propre vérité.
 *
 * Ordre de résolution, décidé et validé :
 *   1. l'API Media Segments de Jellyfin 10.10+ (les CINQ types) ;
 *   2. sinon le greffon intro-skipper, format dictionnaire ;
 *   3. sinon le greffon intro-skipper, format propriétés nommées ;
 *   4. les chapitres nommés COMBLENT les types manquants (Intro/Outro
 *      seulement) — et rien d'autre : aucun repli statistique ;
 *   5. les chapitres AFFINENT la fin d'un Outro, pour ne pas manger la scène
 *      post-générique (`segmentChapters.ts`).
 *
 * L'API native rend une UNION : plusieurs greffons écrivent leurs segments
 * côte à côte, et le même passage y figure deux fois à une seconde près
 * (mesuré sur Endgame et sur la plupart des animés). Garder le premier venu
 * était arbitraire ; `pickBounds` tranche désormais, et il tranche surtout
 * pour l'Outro — un « générique » de dix-sept secondes collé à la fin du
 * fichier n'en est pas un, et le proposer revient à terminer le film.
 *
 * MIROIR : reflété octet pour octet dans `apps/backend/src/playback/` (voir
 * l'en-tête de `segmentTypes.ts`) — ne rien importer hors de la paire.
 */

import {
  PLAYBACK_SEGMENTS_VERSION,
  POST_CREDITS_MIN_MS,
  POST_CREDITS_THRESHOLD_MS,
  TICKS_PER_MS,
  isSegmentType,
  minCredibleOutroMs,
  type PlaybackSegmentsResponse,
  type ResolvedSegment,
  type SegmentType,
} from "./segmentTypes";
import {
  fillFromChapters,
  refineOutroWithChapters,
  type BoundsByType,
  type ChapterMarker,
  type RawBounds,
} from "./segmentChapters";

export type { ChapterMarker } from "./segmentChapters";

// ---------- Payloads BRUTS des sources (typés ici : shared reste sans dépendance) ----------

/** API native : GET /MediaSegments/{itemId} */
export interface JellyfinMediaSegmentDto {
  Type?: string;
  StartTicks?: number;
  EndTicks?: number;
}
export interface MediaSegmentsPayload {
  Items?: JellyfinMediaSegmentDto[] | null;
}

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

export interface SegmentSources {
  mediaSegments?: MediaSegmentsPayload | null;
  pluginDict?: IntroSkipperDictPayload | null;
  pluginTimestamps?: IntroSkipperTimestampsPayload | null;
  chapters?: readonly ChapterMarker[] | null;
}

// ---------- Collecte par source ----------

function pluginBoundsToMs(bounds: IntroSkipperBounds | undefined): RawBounds | null {
  if (!bounds) return null;
  const start = bounds.start ?? bounds.Start ?? 0;
  const end = bounds.end ?? bounds.End ?? 0;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= 0) return null;
  return { startMs: start * 1000, endMs: end * 1000, source: "jellyfin" };
}

/**
 * Le meilleur candidat d'un type, parmi ceux qu'ont écrits les fournisseurs.
 *
 * Pour un OUTRO, deux règles, dans cet ordre :
 *
 *  1. **Écarter l'incrédible** : plus court que le plancher de la durée
 *     (`minCredibleOutroMs`, proportionné au format) ET collé à la fin du
 *     fichier. C'est la signature d'un détecteur d'images noires qui a trouvé
 *     la queue du média — dix-sept secondes sur Iron Man et sur Far From Home.
 *     Le garder, c'est proposer de « passer le générique » dix-sept secondes
 *     avant la fin, donc terminer le film. Si tous les candidats sont
 *     incrédibles, il n'y a pas d'Outro : le film se termine tout seul, et sa
 *     scène post-générique est vue.
 *  2. **Préférer celui qui laisse une scène après lui** — il en dit plus que
 *     les autres. Encore faut-il qu'il soit plausible : un générique de fin ne
 *     commence pas dans la première moitié du média. À défaut, le plus long,
 *     qui couvre le passage entier plutôt qu'un bout.
 *
 * Pour les autres types, les candidats ne diffèrent que d'une seconde ou deux
 * (deux greffons qui disent la même chose) : le plus long les englobe.
 */
function pickBounds(
  type: SegmentType,
  candidates: readonly RawBounds[],
  runtimeMs: number,
): RawBounds | null {
  const duration = (bound: RawBounds): number => bound.endMs - bound.startMs;
  const longest = (list: readonly RawBounds[]): RawBounds =>
    list.reduce((best, bound) => (duration(bound) > duration(best) ? bound : best));

  if (candidates.length === 0) return null;
  if (type !== "Outro" || runtimeMs <= 0) return longest(candidates);

  const floor = minCredibleOutroMs(runtimeMs);
  const credible = candidates.filter(
    (bound) =>
      duration(bound) >= floor || bound.endMs < runtimeMs - POST_CREDITS_THRESHOLD_MS,
  );
  if (credible.length === 0) return null;

  const revealing = credible.filter(
    (bound) =>
      runtimeMs - bound.endMs >= POST_CREDITS_MIN_MS && bound.startMs >= runtimeMs / 2,
  );
  return longest(revealing.length > 0 ? revealing : credible);
}

function collectNative(
  payload: MediaSegmentsPayload | null | undefined,
  runtimeMs: number,
): BoundsByType | null {
  const items = payload?.Items;
  if (!items || items.length === 0) return null;

  const candidates = new Map<SegmentType, RawBounds[]>();
  for (const item of items) {
    if (!isSegmentType(item.Type)) continue;
    const list = candidates.get(item.Type) ?? [];
    list.push({
      startMs: (item.StartTicks ?? 0) / TICKS_PER_MS,
      endMs: (item.EndTicks ?? 0) / TICKS_PER_MS,
      source: "jellyfin",
    });
    candidates.set(item.Type, list);
  }

  const bounds: BoundsByType = new Map();
  for (const [type, list] of candidates) {
    const picked = pickBounds(type, list, runtimeMs);
    if (picked) bounds.set(type, picked);
  }
  // Des Items présents = la source native fait foi, même vidée par le filtrage
  // (comportement historique : les greffons ne sont pas re-consultés).
  return bounds;
}

const DICT_KEYS: ReadonlyArray<readonly [SegmentType, string, string]> = [
  ["Intro", "Introduction", "introduction"],
  ["Outro", "Credits", "credits"],
  ["Recap", "Recap", "recap"],
  ["Preview", "Preview", "preview"],
  ["Commercial", "Commercial", "commercial"],
];

function collectDict(payload: IntroSkipperDictPayload | null | undefined): BoundsByType | null {
  if (!payload) return null;
  const bounds: BoundsByType = new Map();
  for (const [type, pascal, camel] of DICT_KEYS) {
    const ms = pluginBoundsToMs(payload[pascal] ?? payload[camel]);
    if (ms) bounds.set(type, ms);
  }
  return bounds.size > 0 ? bounds : null;
}

function collectTimestamps(
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
    if (ms) bounds.set(type, ms);
  }
  return bounds.size > 0 ? bounds : null;
}

// ---------- Assainissement et verdict de fin ----------

function finalize(type: SegmentType, bound: RawBounds, runtimeMs: number): ResolvedSegment | null {
  if (!Number.isFinite(bound.startMs) || !Number.isFinite(bound.endMs)) return null;
  const startMs = Math.max(0, bound.startMs);
  const endMs = runtimeMs > 0 ? Math.min(bound.endMs, runtimeMs) : bound.endMs;
  if (endMs <= startMs) return null;

  const endsAtMediaEnd = runtimeMs > 0 && endMs >= runtimeMs - POST_CREDITS_THRESHOLD_MS;
  // Deux seuils, pas un : « le segment touche la fin » et « il reste une SCÈNE
  // à voir » ne se répondent pas. Entre les deux vit la zone grise — un fondu,
  // un logo — qu'on ne veut pas vendre comme une scène post-générique.
  // Durée inconnue : impossible de jurer quoi que ce soit — verdict
  // CONSERVATEUR (carte, jamais un bouton de seek trompeur).
  const hasContentAfter =
    runtimeMs > 0 ? runtimeMs - endMs >= POST_CREDITS_MIN_MS : type !== "Outro";

  return {
    type,
    startMs: Math.round(startMs),
    endMs: Math.round(endMs),
    source: bound.source,
    endsAtMediaEnd,
    hasContentAfter,
  };
}

export function resolvePlaybackSegments(
  itemId: string,
  runtimeMs: number,
  sources: SegmentSources,
  resolvedAt = "",
): PlaybackSegmentsResponse {
  const runtime = Number.isFinite(runtimeMs) && runtimeMs > 0 ? Math.round(runtimeMs) : 0;

  const bounds =
    collectNative(sources.mediaSegments, runtime) ??
    collectDict(sources.pluginDict) ??
    collectTimestamps(sources.pluginTimestamps) ??
    (new Map() as BoundsByType);
  fillFromChapters(bounds, sources.chapters, runtime);
  refineOutroWithChapters(bounds, sources.chapters, runtime);

  const segments = [...bounds.entries()]
    .map(([type, bound]) => finalize(type, bound, runtime))
    .filter((segment): segment is ResolvedSegment => segment !== null)
    .sort((a, b) => a.startMs - b.startMs);

  return {
    version: PLAYBACK_SEGMENTS_VERSION,
    itemId,
    runtimeMs: runtime,
    segments,
    resolvedAt,
  };
}
