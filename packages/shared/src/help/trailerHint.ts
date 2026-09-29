/**
 * Le rappel discret des fiches — « Vous ne voyez pas les bandes-annonces ? » —
 * et la lecture du diagnostic du serveur (`TrailerReadiness`, servi par
 * `GET /api/trailers/readiness`), en logique pure : une seule règle pour le
 * web, le miroir, le mobile et les téléviseurs.
 *
 * Le rappel n'est pas une bannière : il ne paraît que sur la fiche d'un titre
 * SANS AUCUNE bande-annonce (ni locale, ni distante, ni Jellyseerr), quand le
 * serveur est NETTEMENT mal réglé — jamais pour un simple titre sans
 * bande-annonce sur un serveur bien réglé —, et jamais quand le compte l'a
 * masqué pour de bon.
 */

import type { TrailerReadiness, TrailerReadinessReason } from "../jellyfinCompat/setupContract";

/** Les fiches où une bande-annonce est attendue : un épisode n'en a presque jamais. */
export const TRAILER_HINT_ITEM_TYPES: readonly string[] = ["Movie", "Series"];

export interface TrailerHintInput {
  /** `Type` Jellyfin du titre de la fiche. */
  itemType: string | undefined;
  /** Le bouton « Bande-annonce » existe (ou s'annonce : bande-annonce locale pas encore listée). */
  trailerVisible: boolean;
  /** Les listes locale et TMDB ont répondu (ou ne sont pas demandées) : l'absence est un FAIT. */
  trailerSettled: boolean;
  /** `undefined` tant que le diagnostic n'est pas arrivé, `null` : pas de diagnostic (serveur trop ancien, panne). */
  readiness: TrailerReadiness | null | undefined;
  /** `undefined` tant que la préférence n'est pas lue. */
  dismissed: boolean | undefined;
}

/**
 * Faut-il poser le rappel sur cette fiche ? Faute de savoir — liste pas encore
 * arrivée, diagnostic inconnu, préférence pas lue —, non : un rappel qui
 * paraît puis disparaît serait pire que pas de rappel.
 */
export function shouldShowTrailerHint(input: TrailerHintInput): boolean {
  if (!input.itemType || !TRAILER_HINT_ITEM_TYPES.includes(input.itemType)) return false;
  if (!input.trailerSettled || input.trailerVisible) return false;
  if (input.dismissed !== false) return false;
  return input.readiness?.state === "misconfigured";
}

/** Une raison, prête à dire : la clé de l'espace `trailerHelp` et ses valeurs. */
export interface TrailerReasonText {
  reason: TrailerReadinessReason;
  key: string;
  values?: Record<string, number>;
}

export interface TrailerReadinessSummary {
  state: "ready" | "misconfigured";
  /** La phrase d'état (espace `trailerHelp`). */
  messageKey: string;
  /** Les causes, dans l'ordre où les traiter (vide quand tout est réglé). */
  reasons: TrailerReasonText[];
}

const REASON_KEY: Record<TrailerReadinessReason, string> = {
  "tmdb-plugin-disabled": "reasonTmdbPluginDisabled",
  "tmdb-fetcher-disabled": "reasonTmdbFetcherDisabled",
  "few-trailers": "reasonFewTrailers",
};

/** L'ordre du guide : l'extension, puis les médiathèques, puis l'actualisation. */
const REASON_ORDER: readonly TrailerReadinessReason[] = ["tmdb-plugin-disabled", "tmdb-fetcher-disabled", "few-trailers"];

/**
 * Le diagnostic, mis en mots pour le guide : l'état et ses causes. `null`
 * quand il n'y a rien à dire (inconnu, absent) — le guide se tait plutôt que
 * de deviner.
 */
export function describeTrailerReadiness(readiness: TrailerReadiness | null | undefined): TrailerReadinessSummary | null {
  if (!readiness || readiness.state === "unknown") return null;
  if (readiness.state === "ready") return { state: "ready", messageKey: "statusReady", reasons: [] };
  const reasons = REASON_ORDER.filter((reason) => readiness.reasons.includes(reason)).map((reason): TrailerReasonText =>
    reason === "few-trailers"
      ? { reason, key: REASON_KEY[reason], values: { percent: Math.round((readiness.coverage ?? 0) * 100) } }
      : { reason, key: REASON_KEY[reason] },
  );
  return { state: "misconfigured", messageKey: "statusMisconfigured", reasons };
}
