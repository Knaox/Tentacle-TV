import type { ContentPolicy } from "./contentPolicy";
import { RATING_ADULT, scoreCertification, stricter, type LiveRatingEntry, type RatingScore } from "./ratingTables";

/**
 * Un titre EXTÉRIEUR (TMDB) face à la politique d'un compte RESTREINT — règle pure,
 * calquée sur ce que Jellyfin ferait du même titre entré dans sa bibliothèque
 * (`BaseItem.IsParentalAllowed`, source v10.11.11), en plus strict là où il hésite.
 * Carnet : docs/DROITS-UTILISATEURS.md § 5.2.
 */

export interface TitleCertifications {
  mediaType: "movie" | "tv";
  /** Le drapeau `adult` de TMDB. */
  adult: boolean;
  /** Pays (ISO 3166-1) → chaînes de certification non vides. */
  byCountry: Record<string, string[]>;
  /** Mots-clés TMDB : ce que Jellyfin pose en ÉTIQUETTES d'un titre importé. */
  keywords: string[];
}

export interface RatingContext {
  /** Le pays de métadonnées de Jellyfin (`MetadataCountryCode`) ; null : inconnu. */
  metadataCountry: string | null;
  /** La table de notes que Jellyfin expose (son pays de métadonnées). */
  live: readonly LiveRatingEntry[];
}

function strictestOf(country: string, certifications: readonly string[], context: RatingContext): RatingScore | null {
  let result: RatingScore | null = null;
  for (const certification of certifications) result = stricter(result, scoreCertification(country, certification, context));
  return result;
}

/**
 * Le score d'un titre, ou null (aucune certification exploitable). Comme le
 * fournisseur TMDB de Jellyfin : le pays de métadonnées, sinon les États-Unis ;
 * une SÉRIE sans l'un ni l'autre prend la plus stricte des autres (Jellyfin
 * prendrait la première : la plus stricte n'est jamais plus large). Dans un pays,
 * plusieurs sorties : la plus stricte.
 */
export function titleScore(title: TitleCertifications, context: RatingContext): RatingScore | null {
  const countries = Object.keys(title.byCountry);
  const find = (code: string | null) => (code ? countries.find((country) => country.toUpperCase() === code.toUpperCase()) : undefined);
  const own = find(context.metadataCountry);
  const ownScore = own ? strictestOf(own, title.byCountry[own], context) : null;
  if (ownScore) return ownScore;
  const us = find("US");
  const usScore = us ? strictestOf(us, title.byCountry[us], context) : null;
  if (usScore) return usScore;
  if (title.mediaType !== "tv") return null;
  let result: RatingScore | null = null;
  for (const country of countries) result = stricter(result, strictestOf(country, title.byCountry[country], context));
  return result;
}

/** `IsParentalAllowed` de Jellyfin, pour un score connu. */
export function scoreAllowed(score: RatingScore, policy: Pick<ContentPolicy, "maxParentalRating" | "maxParentalSubRating">): boolean {
  const max = policy.maxParentalRating;
  if (max === null) return true;
  if (score.score !== max) return score.score < max;
  return policy.maxParentalSubRating === null || (score.subScore ?? 0) <= policy.maxParentalSubRating;
}

/** Les étiquettes de Jellyfin (`IsVisibleViaTags`) : une bloquée suffit à cacher ; des permises exigent l'une d'elles. */
export function tagsAllowed(keywords: readonly string[], policy: Pick<ContentPolicy, "blockedTags" | "allowedTags">): boolean {
  const tags = new Set(keywords.map((keyword) => keyword.trim().toLowerCase()));
  if (policy.blockedTags.some((tag) => tags.has(tag.trim().toLowerCase()))) return false;
  if (policy.allowedTags.length > 0 && !policy.allowedTags.some((tag) => tags.has(tag.trim().toLowerCase()))) return false;
  return true;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/**
 * Les plages horaires (`User.IsParentalScheduleAllowed`) : aucune = à toute heure ;
 * sinon l'heure LOCALE (du serveur Tentacle — celle de Jellyfin n'est pas lisible)
 * doit tomber dans l'une. Hors plage : rien d'extérieur.
 */
export function scheduleAllows(policy: Pick<ContentPolicy, "accessSchedules">, now: Date): boolean {
  if (policy.accessSchedules.length === 0) return true;
  const day = DAYS[now.getDay()];
  const hour = now.getHours() + now.getMinutes() / 60;
  return policy.accessSchedules.some((entry) => {
    const days =
      entry.dayOfWeek === "Everyday"
        ? DAYS
        : entry.dayOfWeek === "Weekday"
          ? DAYS.slice(1, 6)
          : entry.dayOfWeek === "Weekend"
            ? [DAYS[0], DAYS[6]]
            : [entry.dayOfWeek];
    return (days as readonly string[]).includes(day) && hour >= entry.startHour && hour <= entry.endHour;
  });
}

/**
 * Un compte RESTREINT peut-il voir ce titre ? Caché : `adult`, un score adulte,
 * aucune certification exploitable (§ 5 : jamais montré à un compte restreint, même
 * si ses types non classés ne sont pas bloqués), une note au-dessus de la sienne,
 * une étiquette bloquée, aucune étiquette permise, hors de ses plages horaires.
 * Une politique illisible (fermée) ne laisse rien passer.
 */
export function restrictedAllows(
  title: TitleCertifications | null,
  policy: ContentPolicy,
  context: RatingContext,
  now: Date,
): boolean {
  if (!policy.readable || !title || title.adult) return false;
  if (!scheduleAllows(policy, now)) return false;
  const score = titleScore(title, context);
  if (!score || score.score >= RATING_ADULT) return false;
  if (!scoreAllowed(score, policy)) return false;
  return tagsAllowed(title.keywords, policy);
}
