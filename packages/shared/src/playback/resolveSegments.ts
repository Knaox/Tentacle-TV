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
 *      post-générique (`segmentChapters.ts`) ;
 *   6. à défaut de chapitres, les VIGNETTES de la barre de progression rendent
 *      le même service — et fournissent le générique quand personne ne l'a vu
 *      (`creditsFromFrames.ts`).
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
import { applyClaimGuards } from "./claimGuards";
import { applyFrameVerdict, type FrameVerdict } from "./creditsFromFrames";
import {
  collectDict,
  collectTimestamps,
  type IntroSkipperDictPayload,
  type IntroSkipperTimestampsPayload,
} from "./segmentPlugins";

export type { ChapterMarker } from "./segmentChapters";
export type {
  IntroSkipperBounds,
  IntroSkipperDictPayload,
  IntroSkipperTimestampsPayload,
} from "./segmentPlugins";

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

export interface SegmentSources {
  mediaSegments?: MediaSegmentsPayload | null;
  pluginDict?: IntroSkipperDictPayload | null;
  pluginTimestamps?: IntroSkipperTimestampsPayload | null;
  chapters?: readonly ChapterMarker[] | null;
  /**
   * Ce que les vignettes ont vu du générique de fin, quand on a eu à regarder.
   *
   * Elle arrive DÉJÀ analysée : la lecture des planches et le calcul des mesures
   * vivent côté serveur (`services/trickplayFrames.ts`), la décision vit ici.
   */
  frames?: FrameVerdict | null;
}

// ---------- Collecte par source ----------

/**
 * Le meilleur candidat d'un type, parmi ceux qu'ont écrits les fournisseurs.
 *
 * Pour un OUTRO, deux règles, dans cet ordre :
 *
 *  1. **Écarter l'incrédible** : plus court que `minCredibleOutroMs` ET collé
 *     à la fin. C'est la signature d'un détecteur d'images noires qui a trouvé
 *     la queue du média — dix-sept secondes sur Iron Man. Le garder, c'est
 *     proposer de « passer le générique » dix-sept secondes avant la fin, donc
 *     terminer le film. Tous incrédibles = pas d'Outro : le film se termine
 *     seul, et sa scène post-générique est vue.
 *  2. **Préférer celui qui laisse une scène après lui** — il en dit plus. Et
 *     qu'il soit plausible : un générique ne commence pas dans la première
 *     moitié du média. À défaut, le plus long.
 *
 * Pour les autres types, les candidats ne diffèrent que d'une seconde ou deux
 * (deux greffons qui disent la même chose) : le plus long les englobe.
 */
/**
 * Groupe les candidats qui se CHEVAUCHENT.
 *
 * C'est ce qui distingue deux fournisseurs disant la même chose à une seconde
 * près — mesuré sur Endgame et la plupart des animés — de deux marqueurs
 * vraiment distincts : le générique, puis le générique FINAL d'après une scène
 * post-générique.
 */
function groupOverlapping(candidates: readonly RawBounds[]): RawBounds[][] {
  const sorted = [...candidates].sort((a, b) => a.startMs - b.startMs);
  const groups: RawBounds[][] = [];
  for (const bound of sorted) {
    const last = groups[groups.length - 1];
    const lastEnd = last ? Math.max(...last.map((b) => b.endMs)) : -1;
    if (last && bound.startMs < lastEnd) last.push(bound);
    else groups.push([bound]);
  }
  return groups;
}

/**
 * Au-delà de cet écart entre les FINS d'un même groupe, les fournisseurs ne
 * décrivent plus le même générique — le désaccord porte précisément sur « où
 * finit-il », c'est-à-dire sur la scène qu'un candidat prétend révéler.
 */
const END_AGREEMENT_MS = 15_000;

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

  // Préférer le candidat « révélateur » suppose que les fournisseurs sont
  // d'ACCORD sur la fin. Quand leurs fins divergent, la « scène » révélée est
  // exactement ce qui est contesté — mesuré sur Re:Zero S4E2 : fins à 42 s
  // d'écart, et le révélateur promettait une scène post-générique alors que
  // l'épisode continue SOUS les crédits. Le plus long l'emporte alors ; s'il
  // court jusqu'au bout du fichier, l'analyse des vignettes garde sa chance de
  // re-révéler une VRAIE scène (elle, ne fabrique rien sur les faux cas).
  const ends = credible.map((bound) => bound.endMs);
  if (Math.max(...ends) - Math.min(...ends) > END_AGREEMENT_MS) return longest(credible);

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
    if (type !== "Outro") {
      const picked = pickBounds(type, list, runtimeMs);
      if (picked) bounds.set(type, [picked]);
      continue;
    }
    // Générique : au plus DEUX marqueurs disjoints — le principal et le final.
    // Le filtre de crédibilité ne s'applique qu'au marqueur SOLITAIRE : un
    // générique final court, après une scène, est parfaitement légitime, alors
    // qu'un marqueur unique et court n'est que la queue du fichier.
    const groups = groupOverlapping(list);
    const kept = (groups.length > 2 ? [groups[0], groups[groups.length - 1]] : groups)
      .map((group) => pickBounds(groups.length === 1 ? "Outro" : "Recap", group, runtimeMs))
      .filter((bound): bound is RawBounds => bound !== null);
    if (kept.length > 0) bounds.set("Outro", kept);
  }
  // Des Items présents = la source native fait foi, même vidée par le filtrage
  // (comportement historique : les greffons ne sont pas re-consultés).
  return bounds;
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
  libraryId: string | null = null,
): PlaybackSegmentsResponse {
  const runtime = Number.isFinite(runtimeMs) && runtimeMs > 0 ? Math.round(runtimeMs) : 0;

  const bounds =
    collectNative(sources.mediaSegments, runtime) ??
    collectDict(sources.pluginDict) ??
    collectTimestamps(sources.pluginTimestamps) ??
    (new Map() as BoundsByType);
  fillFromChapters(bounds, sources.chapters, runtime);
  refineOutroWithChapters(bounds, sources.chapters, runtime);
  // Les gardes de vraisemblance écartent les réclamations absurdes (intro en
  // fin de fichier, et l'outro qui la chevauche) quelle que soit leur source.
  applyClaimGuards(bounds, runtime);
  // EN DERNIER, et c'est ce qui fait que l'analyse ne gêne personne : tout ce
  // qui précède a eu sa chance, et elle ne parle que sur ce qui reste — un
  // générique absent, ou un générique qui court jusqu'au bout du fichier.
  applyFrameVerdict(bounds, sources.frames ?? null, runtime);

  const segments = [...bounds.entries()]
    .flatMap(([type, list]) => list.map((bound) => finalize(type, bound, runtime)))
    .filter((segment): segment is ResolvedSegment => segment !== null)
    .sort((a, b) => a.startMs - b.startMs);

  return {
    version: PLAYBACK_SEGMENTS_VERSION,
    itemId,
    runtimeMs: runtime,
    segments,
    libraryId,
    resolvedAt,
  };
}
