import { useTranslation } from "react-i18next";
import { formatCommunityRating, formatUserScore } from "@tentacle-tv/shared";
import { StarGlyph } from "./cardGlyphs";
import { ON_MEDIA_ACCENT_TEXT, ON_MEDIA_PILL } from "./onMedia";

interface CardRatingBadgeProps {
  /** Note globale /10 (CommunityRating Jellyfin ou voteAverage TMDB). */
  rating: number | null | undefined;
  /**
   * Note de l'utilisateur, 1..10. Présente, elle s'ajoute dans la MÊME
   * pastille, sur un segment au dégradé de marque — « ★ 8.2 | ★ 7 ».
   */
  userScore?: number | null;
  /** Faux = fondu de sortie (les contrôles de survol prennent la place). */
  shown?: boolean;
  /** Au-dessus du voile de survol (z-30) : la note reste lisible en survol. */
  raised?: boolean;
  /**
   * Autre ancrage que le coin bas-gauche. La vignette 16:9 d'un épisode y a
   * déjà son code et son titre : sa note se pose en haut.
   */
  className?: string;
}

/**
 * La note d'une carte : puce d'encre posée SUR média (constante dans les
 * deux thèmes), étoile ivoire — jamais dorée.
 *
 * Deux segments au plus : la note globale, puis celle de l'utilisateur, à la
 * teinte franche — la même échelle (/10), côte à côte, pour qu'on
 * les compare sans calcul. Un titre noté mais sans note globale n'affiche que
 * le segment personnel.
 *
 * Aucun backdrop-filter : montée en permanence, seule l'opacité transitionne
 * (règle GPU du dépôt).
 */
export function CardRatingBadge({
  rating,
  userScore = null,
  shown = true,
  raised = false,
  className,
}: CardRatingBadgeProps) {
  const { t } = useTranslation("cards");
  const community = rating != null && rating > 0 ? formatCommunityRating(rating) : null;
  const mine = userScore != null && userScore > 0 ? formatUserScore(userScore) : null;
  if (!community && !mine) return null;

  const label = [
    community ? t("communityRating", { score: community }) : null,
    mine ? t("userRating", { score: mine }) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role="img"
      className={`lg-badge absolute ${className ?? "bottom-[7px] left-[7px]"} ${raised ? "z-30" : "z-10"} flex h-[22px] items-stretch overflow-hidden rounded-chip text-xs font-bold leading-none text-on-media-primary transition-opacity duration-hover ${ON_MEDIA_PILL} ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      aria-label={label}
      title={label}
      // Repère stable de la note posée SUR l'image : la LG, dont le focus ne
      // passe pas par `hovered`, l'efface par sa feuille (cards-tv.css).
      data-card-rating=""
    >
      {community && (
        <span className="flex items-center gap-[3px] px-1.5 tabular-nums">
          <StarGlyph />
          {community}
        </span>
      )}
      {mine && (
        // SA note : à la teinte franche (un état du compte), séparée d'un filet — plus un aplat au dégradé.
        <span className={`flex items-center gap-[3px] px-1.5 tabular-nums ${ON_MEDIA_ACCENT_TEXT} ${community ? "shadow-[inset_1px_0_0_rgba(255,255,255,0.18)]" : ""}`}>
          <StarGlyph />
          {mine}
        </span>
      )}
    </div>
  );
}
