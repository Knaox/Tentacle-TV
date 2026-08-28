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
 *      seulement) — et rien d'autre : aucun repli statistique.
 *
 * MIROIR : reflété octet pour octet dans `apps/backend/src/playback/` (voir
 * l'en-tête de `segmentTypes.ts`) — ne rien importer hors de la paire.
 */

import {
  PLAYBACK_SEGMENTS_VERSION,
  POST_CREDITS_THRESHOLD_MS,
  TICKS_PER_MS,
  isSegmentType,
  type PlaybackSegmentsResponse,
  type ResolvedSegment,
  type SegmentType,
} from "./segmentTypes";

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
  [cle: string]: IntroSkipperBounds | undefined;
}

/** Greffon : GET /Episode/{id}/Timestamps (propriétés nommées). */
export interface IntroSkipperTimestampsPayload {
  introduction?: IntroSkipperBounds;
  credits?: IntroSkipperBounds;
  recap?: IntroSkipperBounds;
  preview?: IntroSkipperBounds;
  commercial?: IntroSkipperBounds;
}

/** Chapitre Jellyfin — le champ `Chapters` du DTO de l'item. */
export interface ChapterMarker {
  StartPositionTicks: number;
  Name: string;
}

export interface SegmentSources {
  mediaSegments?: MediaSegmentsPayload | null;
  pluginDict?: IntroSkipperDictPayload | null;
  pluginTimestamps?: IntroSkipperTimestampsPayload | null;
  chapters?: readonly ChapterMarker[] | null;
}

// ---------- Motifs de chapitres (EN + FR) ----------

// Un chapitre d'ouverture d'abord : « Opening Credits » ou « Générique de
// début » contiennent aussi un mot du motif de fin — l'intro se teste en
// premier et un chapitre reconnu comme intro ne peut pas être un générique.
const CHAPTER_INTRO_PATTERN =
  /(\bintro\b|\bintroduction\b|\bopening\b|g[ée]n[ée]rique\s+de\s+d[ée]but)/i;
const CHAPTER_OUTRO_PATTERN =
  /(end\s*credits|\bcredits?\b|\boutro\b|\bending\b|g[ée]n[ée]rique(?!\s+de\s+d[ée]but))/i;

// ---------- Collecte par source ----------

interface RawBounds {
  startMs: number;
  endMs: number;
  source: "jellyfin" | "chapters";
}

type BoundsByType = Map<SegmentType, RawBounds>;

function pluginBoundsToMs(bornes: IntroSkipperBounds | undefined): RawBounds | null {
  if (!bornes) return null;
  const start = bornes.start ?? bornes.Start ?? 0;
  const end = bornes.end ?? bornes.End ?? 0;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= 0) return null;
  return { startMs: start * 1000, endMs: end * 1000, source: "jellyfin" };
}

function collectNative(payload: MediaSegmentsPayload | null | undefined): BoundsByType | null {
  const items = payload?.Items;
  if (!items || items.length === 0) return null;
  const bornes: BoundsByType = new Map();
  for (const item of items) {
    if (!isSegmentType(item.Type) || bornes.has(item.Type)) continue;
    bornes.set(item.Type, {
      startMs: (item.StartTicks ?? 0) / TICKS_PER_MS,
      endMs: (item.EndTicks ?? 0) / TICKS_PER_MS,
      source: "jellyfin",
    });
  }
  // Des Items présents = la source native fait foi, même vidée par le filtrage
  // (comportement historique : les greffons ne sont pas re-consultés).
  return bornes;
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
  const bornes: BoundsByType = new Map();
  for (const [type, pascal, camel] of DICT_KEYS) {
    const ms = pluginBoundsToMs(payload[pascal] ?? payload[camel]);
    if (ms) bornes.set(type, ms);
  }
  return bornes.size > 0 ? bornes : null;
}

function collectTimestamps(
  payload: IntroSkipperTimestampsPayload | null | undefined,
): BoundsByType | null {
  if (!payload) return null;
  const champs: ReadonlyArray<readonly [SegmentType, IntroSkipperBounds | undefined]> = [
    ["Intro", payload.introduction],
    ["Outro", payload.credits],
    ["Recap", payload.recap],
    ["Preview", payload.preview],
    ["Commercial", payload.commercial],
  ];
  const bornes: BoundsByType = new Map();
  for (const [type, brut] of champs) {
    const ms = pluginBoundsToMs(brut);
    if (ms) bornes.set(type, ms);
  }
  return bornes.size > 0 ? bornes : null;
}

/**
 * Comble Intro et Outro manquants depuis les chapitres nommés. Fin d'un
 * chapitre = début du suivant ; pour un générique en dernier chapitre, la fin
 * est la durée du média — le « +120 s » deviné de l'ancienne normalisation
 * disparaît. Sans durée connue, aucun Outro de chapitre n'est posé (trop
 * d'heuristique empilée pour oser un bouton).
 */
function fillFromChapters(
  bornes: BoundsByType,
  chapters: readonly ChapterMarker[] | null | undefined,
  runtimeMs: number,
): void {
  if (!chapters || chapters.length < 2) return;

  let outro: RawBounds | null = null;
  for (let i = 0; i < chapters.length; i++) {
    const nom = chapters[i].Name;
    const startMs = chapters[i].StartPositionTicks / TICKS_PER_MS;
    const nextStartMs =
      i + 1 < chapters.length ? chapters[i + 1].StartPositionTicks / TICKS_PER_MS : null;

    if (CHAPTER_INTRO_PATTERN.test(nom)) {
      if (!bornes.has("Intro") && nextStartMs !== null) {
        bornes.set("Intro", { startMs, endMs: nextStartMs, source: "chapters" });
      }
      continue;
    }
    if (runtimeMs > 0 && CHAPTER_OUTRO_PATTERN.test(nom)) {
      // Le DERNIER chapitre correspondant l'emporte — c'est lui, le générique
      // de fin (comportement historique conservé).
      outro = { startMs, endMs: nextStartMs ?? runtimeMs, source: "chapters" };
    }
  }
  if (outro && !bornes.has("Outro")) bornes.set("Outro", outro);
}

// ---------- Assainissement et verdict de fin ----------

function finalize(type: SegmentType, borne: RawBounds, runtimeMs: number): ResolvedSegment | null {
  if (!Number.isFinite(borne.startMs) || !Number.isFinite(borne.endMs)) return null;
  const startMs = Math.max(0, borne.startMs);
  const endMs = runtimeMs > 0 ? Math.min(borne.endMs, runtimeMs) : borne.endMs;
  if (endMs <= startMs) return null;

  const endsAtMediaEnd = runtimeMs > 0 && endMs >= runtimeMs - POST_CREDITS_THRESHOLD_MS;
  // Durée inconnue : impossible de jurer qu'une scène suit le générique — on
  // rend le verdict CONSERVATEUR (carte, jamais un bouton de seek trompeur).
  const hasContentAfter = runtimeMs > 0 ? !endsAtMediaEnd : type !== "Outro";

  return {
    type,
    startMs: Math.round(startMs),
    endMs: Math.round(endMs),
    source: borne.source,
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

  const bornes =
    collectNative(sources.mediaSegments) ??
    collectDict(sources.pluginDict) ??
    collectTimestamps(sources.pluginTimestamps) ??
    (new Map() as BoundsByType);
  fillFromChapters(bornes, sources.chapters, runtime);

  const segments = [...bornes.entries()]
    .map(([type, borne]) => finalize(type, borne, runtime))
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
