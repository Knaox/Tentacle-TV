import { useTranslation } from "react-i18next";
import { StarIcon } from "../icons/HeroIcons";
import { StarRating } from "./StarRating";

export interface EpisodeRatingValues {
  /** Note globale sur 10 (TMDB, ou Jellyfin à défaut) — null sans vote. */
  community: number | null;
  /** Note du compte, 1..10 — null si l'épisode n'est pas noté. */
  mine: number | null;
}

/** La note globale d'un épisode : étoile de marque (jamais dorée), chiffre au dixième. */
export function CommunityScore({ score, className = "" }: { score: number | null; className?: string }) {
  const { t } = useTranslation("reco");
  if (score == null || score <= 0) return null;
  const text = score.toFixed(1);
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${className}`}
      aria-label={t("communityRatingAria", { score: text })}
    >
      <span aria-hidden className="text-[var(--brand-accent)]">
        <StarIcon />
      </span>
      {text}
    </span>
  );
}

/** Lecture seule (liste d'épisodes du lecteur) : note globale, puis celle du compte en accent. */
export function EpisodeScoreChips({ community, mine }: EpisodeRatingValues) {
  const { t } = useTranslation("reco");
  if ((community == null || community <= 0) && mine == null) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <CommunityScore score={community} />
      {mine != null && (
        <span className="font-semibold tabular-nums text-[var(--brand-accent-light)]" aria-label={t("yourRating")}>
          {t("ratingValue", { score: mine })}
        </span>
      )}
    </span>
  );
}

interface EpisodeRatingLineProps extends EpisodeRatingValues {
  onRate: (score: number) => void;
  onClear: () => void;
}

/**
 * La ligne de notation d'un épisode (liste Saisons & Épisodes) : note globale,
 * étoiles de saisie compactes, chiffre. Aucun clic n'atteint la ligne
 * d'épisode, qui lancerait la lecture.
 */
export function EpisodeRatingLine({ community, mine, onRate, onClear }: EpisodeRatingLineProps) {
  const { t } = useTranslation("reco");
  return (
    <span
      className="inline-flex items-center gap-2"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <CommunityScore score={community} />
      <StarRating size="xs" value={mine} onRate={onRate} onClear={onClear} />
      {mine != null && (
        <span className="font-semibold tabular-nums text-content-secondary">{t("ratingValue", { score: mine })}</span>
      )}
    </span>
  );
}
