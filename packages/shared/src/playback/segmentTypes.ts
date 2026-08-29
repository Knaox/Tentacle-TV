/**
 * Le contrat des segments de lecture — version 1.
 *
 * C'est LA forme que tout le monde consomme : le résolveur du backend la
 * produit (`GET /api/playback/segments/:itemId`), les lecteurs la lisent, le
 * snapshot hors ligne du bureau la persiste telle quelle. Aucun client ne
 * recalcule quoi que ce soit : les décisions (priorité des sources, repli
 * chapitres, « le générique s'arrête-t-il à la fin ? ») sont prises une seule
 * fois, dans `resolveSegments.ts`.
 *
 * Toutes les positions sont en MILLISECONDES depuis le début du média — jamais
 * des ticks Jellyfin, jamais des secondes. La conversion se fait aux frontières
 * (résolveur côté serveur, coquille de lecture côté client), pas au milieu.
 *
 * MIROIR : ce fichier, `resolveSegments.ts`, `segmentChapters.ts` et
 * `playbackSettings.ts` sont reflétés OCTET POUR OCTET
 * dans `apps/backend/src/playback/` — le backend ne dépend pas de
 * `@tentacle-tv/shared` (tsc CommonJS, image Docker sans packages/ ; précédent
 * `watchTogether/protocol.ts`). Toute modification se fait ICI puis se recopie
 * là-bas ; `apps/backend/src/playback/sharedMirror.test.ts` échoue au moindre
 * octet d'écart. La paire est AUTONOME (aucun import hors d'elle-même) pour
 * que la copie reste possible.
 */

/** 1 tick Jellyfin = 100 ns → 10 000 ticks par milliseconde. */
export const TICKS_PER_MS = 10_000;

/** Les cinq types que Jellyfin sait signaler (API Media Segments 10.10+). */
export type SegmentType = "Intro" | "Outro" | "Recap" | "Preview" | "Commercial";

export const SEGMENT_TYPES: readonly SegmentType[] = [
  "Intro",
  "Outro",
  "Recap",
  "Preview",
  "Commercial",
];

export function isSegmentType(value: unknown): value is SegmentType {
  return typeof value === "string" && (SEGMENT_TYPES as readonly string[]).includes(value);
}

export const PLAYBACK_SEGMENTS_VERSION = 1;

/**
 * Un générique qui s'arrête à moins de 15 s du bout s'arrête « à la fin » :
 * ce qui reste n'est pas une scène post-générique, c'est la queue du fichier.
 */
export const POST_CREDITS_THRESHOLD_MS = 15_000;

/**
 * La durée minimale de ce qui MÉRITE d'être appelé une scène post-générique.
 *
 * Distinct du seuil ci-dessus, et pas par coquetterie : celui-là dit « le
 * segment touche la fin », celui-ci dit « il y a quelque chose à voir ». Entre
 * les deux vit la zone grise — un fondu, un logo de studio, quelques secondes
 * de noir — qu'on ne veut pas vendre comme une scène. Vingt secondes : le
 * stinger le plus court du corpus Marvel en fait plus du double.
 */
export const POST_CREDITS_MIN_MS = 20_000;

/**
 * Sous cette durée, un « générique de fin » n'en est pas un — pour un long
 * métrage. Voir `MIN_CREDIBLE_OUTRO_RATIO` pour les formats courts.
 *
 * Mesuré sur l'instance de test : Iron Man porte un Outro de 17 s
 * (125:43 → 126:00) et Far From Home un de 17 s aussi — la queue noire du
 * fichier, pas le générique, produite par un détecteur d'images noires dont
 * le plancher est à 15 s. Les accepter, c'est proposer « passer le générique »
 * dix-sept secondes avant la fin, donc terminer le film.
 */
export const MIN_CREDIBLE_OUTRO_MS = 45_000;

/**
 * Le même plancher, mais proportionnel — et c'est lui qui sauve les formats
 * courts.
 *
 * Un générique est proportionné à la production : celui d'un long métrage
 * court des minutes, celui d'une sitcom de vingt minutes tient en quarante
 * secondes. Un plancher absolu de 45 s punissait donc les seconds : audité sur
 * la médiathèque, il rejetait Malcolm (44 s sur 22:23) et How I Met Your
 * Mother (27 s sur 21:42), qui sont de VRAIS génériques.
 *
 * Le plancher retenu est donc `min(45 s, 1 % de la durée)`. Sur ce même audit
 * il garde les deux sitcoms et rejette toujours les fausses détections : Iron
 * Man (0,22 %), Far From Home (0,22 %), Jerry Maguire (0,24 %), Hôtel
 * Transylvanie (0,55 %).
 */
export const MIN_CREDIBLE_OUTRO_RATIO = 0.01;

/** Le plancher effectif d'un générique crédible, pour une durée donnée. */
export function minCredibleOutroMs(runtimeMs: number): number {
  return runtimeMs > 0
    ? Math.min(MIN_CREDIBLE_OUTRO_MS, runtimeMs * MIN_CREDIBLE_OUTRO_RATIO)
    : MIN_CREDIBLE_OUTRO_MS;
}

export interface ResolvedSegment {
  type: SegmentType;
  startMs: number;
  endMs: number;
  /** D'où vient la borne : segments Jellyfin (natif ou greffon), ou chapitres nommés. */
  source: "jellyfin" | "chapters";
  /** `endMs` touche la fin du média (au seuil POST_CREDITS_THRESHOLD_MS près). */
  endsAtMediaEnd: boolean;
  /** Il reste quelque chose à voir après ce segment — une scène post-générique. */
  hasContentAfter: boolean;
}

export interface PlaybackSegmentsResponse {
  version: 1;
  itemId: string;
  /** Durée du média en ms ; 0 quand elle n'a pas pu être établie. */
  runtimeMs: number;
  segments: ResolvedSegment[];
  /** Horodatage ISO de la résolution — injecté par l'appelant, jamais lu ici. */
  resolvedAt: string;
}

/** La réponse « rien » : média sans segments, serveur trop ancien, hors ligne sec. */
export function emptyPlaybackSegments(
  itemId: string,
  resolvedAt: string,
  runtimeMs = 0,
): PlaybackSegmentsResponse {
  return {
    version: PLAYBACK_SEGMENTS_VERSION,
    itemId,
    runtimeMs,
    segments: [],
    resolvedAt,
  };
}

export function findSegment(
  segments: readonly ResolvedSegment[],
  type: SegmentType,
): ResolvedSegment | null {
  return segments.find((segment) => segment.type === type) ?? null;
}

/**
 * TOUS les segments d'un type, dans l'ordre de lecture.
 *
 * Un média peut en porter deux du même type, et c'est le modèle de Plex :
 * générique, scène post-générique, générique FINAL. Le second marqueur est la
 * donnée la plus sûre qui existe sur « quand la suite peut se proposer » — il
 * ne doit pas être écrasé par le premier.
 */
export function findSegments(
  segments: readonly ResolvedSegment[],
  type: SegmentType,
): ResolvedSegment[] {
  return segments.filter((segment) => segment.type === type);
}

/**
 * Relit le contrat depuis le monde extérieur — réponse HTTP, `segments.json`
 * du snapshot hors ligne. `null` si ce n'en est pas un (autre version, forme
 * étrangère) : à l'appelant de retomber sur du vide ou sur l'ancien format.
 * Les segments illisibles sont écartés un à un, jamais toute la réponse.
 */
export function parsePlaybackSegmentsResponse(raw: unknown): PlaybackSegmentsResponse | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== PLAYBACK_SEGMENTS_VERSION) return null;
  if (typeof o.itemId !== "string" || !Array.isArray(o.segments)) return null;

  const toNumber = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const segments: ResolvedSegment[] = [];
  for (const rawSegment of o.segments as unknown[]) {
    if (typeof rawSegment !== "object" || rawSegment === null) continue;
    const s = rawSegment as Record<string, unknown>;
    const startMs = toNumber(s.startMs);
    const endMs = toNumber(s.endMs);
    if (!isSegmentType(s.type) || startMs === null || endMs === null || endMs <= startMs) continue;
    segments.push({
      type: s.type,
      startMs,
      endMs,
      source: s.source === "chapters" ? "chapters" : "jellyfin",
      endsAtMediaEnd: s.endsAtMediaEnd === true,
      hasContentAfter: s.hasContentAfter === true,
    });
  }

  const runtimeMs = toNumber(o.runtimeMs);
  return {
    version: PLAYBACK_SEGMENTS_VERSION,
    itemId: o.itemId,
    runtimeMs: runtimeMs !== null && runtimeMs > 0 ? Math.round(runtimeMs) : 0,
    segments,
    resolvedAt: typeof o.resolvedAt === "string" ? o.resolvedAt : "",
  };
}
