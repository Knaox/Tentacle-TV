import { useTranslation } from "react-i18next";
import { StarIcon } from "../icons/HeroIcons";

interface CardRatingBadgeProps {
  /** Note globale /10 (CommunityRating Jellyfin ou voteAverage TMDB). */
  rating: number | null | undefined;
  /** Faux = fondu de sortie (les contrôles de survol prennent la place). */
  shown?: boolean;
  /** Au-dessus du voile de survol (z-30) : la note reste lisible en survol. */
  raised?: boolean;
}

/**
 * Note globale d'une affiche : chip posée SUR média (noir/blanc constant dans
 * les deux thèmes), étoile de MARQUE — jamais dorée. Aucun backdrop-filter :
 * montée en permanence, seule l'opacité transitionne (règle GPU du dépôt).
 */
export function CardRatingBadge({ rating, shown = true, raised = false }: CardRatingBadgeProps) {
  const { t } = useTranslation("reco");
  if (rating == null || rating <= 0) return null;
  const score = rating.toFixed(1);

  return (
    <div
      className={`absolute bottom-2 left-2 ${raised ? "z-30" : "z-10"} flex items-center gap-1 rounded-md border border-white/20 bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white transition-opacity duration-150 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      aria-label={t("communityRatingAria", { score })}
    >
      <span aria-hidden className="text-[var(--brand-accent)]">
        <StarIcon />
      </span>
      {score}
    </div>
  );
}
