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
 * MIROIR : ce fichier et `resolveSegments.ts` sont reflétés OCTET POUR OCTET
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

export function isSegmentType(valeur: unknown): valeur is SegmentType {
  return typeof valeur === "string" && (SEGMENT_TYPES as readonly string[]).includes(valeur);
}

export const PLAYBACK_SEGMENTS_VERSION = 1;

/**
 * Un générique qui s'arrête à moins de 15 s du bout s'arrête « à la fin » :
 * ce qui reste n'est pas une scène post-générique, c'est la queue du fichier.
 */
export const POST_CREDITS_THRESHOLD_MS = 15_000;

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
