import { useTranslation } from "react-i18next";
import { formatCommunityRating, formatUserScore } from "@tentacle-tv/shared";
import { StarGlyph } from "./cardGlyphs";

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
   * Dans le FLUX plutôt qu'ancrée au coin de l'affiche.
   *
   * Ancrée, elle ne sait rien de ce qu'un calque de survol pose sur la même
   * bande : c'est au pixel près que ça tient, ou pas (cf. RecoCardHoverLayer,
   * où « Ne plus me proposer » lui mordait dessus). En flux, la rangée qui
   * l'accueille garantit l'espacement à toute largeur de carte.
   */
  inline?: boolean;
  /**
   * Autre ancrage que le coin bas-gauche. La vignette 16:9 d'un épisode y a
   * déjà son code et son titre : sa note se pose en haut.
   */
  className?: string;
}

/**
 * La note d'une carte : chip posée SUR média (noir/blanc constant dans les
 * deux thèmes), étoile de MARQUE — jamais dorée.
 *
 * Deux segments au plus : la note globale, puis celle de l'utilisateur, sur
 * le dégradé violet → rose — la même échelle (/10), côte à côte, pour qu'on
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
  inline = false,
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
      className={`${
        inline ? "shrink-0" : `absolute ${className ?? "bottom-2 left-2"} ${raised ? "z-30" : "z-10"}`
      } flex h-5 items-stretch overflow-hidden rounded-md border border-white/20 bg-black/70 text-[11px] font-semibold leading-none text-white transition-opacity duration-150 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      aria-label={label}
      title={label}
      // Repère stable de la note posée SUR l'image : la LG, dont le focus ne
      // passe pas par `hovered`, l'efface par sa feuille (cards-tv.css).
      data-card-rating={inline ? undefined : ""}
    >
      {community && (
        <span className="flex items-center gap-1 px-1.5 tabular-nums">
          <span className="text-[var(--brand-accent)]">
            <StarGlyph />
          </span>
          {community}
        </span>
      )}
      {mine && (
        <span className="flex items-center gap-0.5 bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] px-1.5 tabular-nums text-cta-brand-fg">
          <StarGlyph className="h-2.5 w-2.5" />
          {mine}
        </span>
      )}
    </div>
  );
}
