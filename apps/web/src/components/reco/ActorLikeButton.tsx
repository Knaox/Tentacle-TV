import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";

interface ActorLikeButtonProps {
  name: string;
  liked: boolean;
  pending?: boolean;
  onToggle: () => void;
}

/**
 * Cœur « J'aime cet acteur » posé sur le portrait du casting. Toujours monté,
 * révélé par OPACITÉ seule au survol de la tuile (aucun backdrop-filter — pas
 * un cas de montage à la demande) ; visible en permanence quand aimé, et au
 * focus clavier. aria-pressed porte l'état.
 */
export function ActorLikeButton({ name, liked, pending, onToggle }: ActorLikeButtonProps) {
  const { t } = useTranslation("media");
  const label = liked ? t("media:unlikeActor", { name }) : t("media:likeActor", { name });

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`absolute right-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border shadow-md transition-opacity duration-150 focus-visible:opacity-100 ${
        liked
          ? "border-transparent bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-cta-brand-fg opacity-100"
          : "border-line-strong bg-surface-modal text-content-secondary opacity-0 group-hover/actor:opacity-100"
      }`}
    >
      <Heart size={13} fill={liked ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
