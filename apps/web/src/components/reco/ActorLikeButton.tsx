import { useTranslation } from "react-i18next";
import { HeartIcon as Heart } from "@phosphor-icons/react/dist/csr/Heart";

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
      // Aimé : le cœur plein à la teinte franche, sur l'encre du menu — plus d'aplat au dégradé de marque.
      className={`absolute right-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-surface-dropdown shadow-elev-1 transition-[opacity,transform] duration-press ease-out active:scale-[var(--press-scale)] focus-visible:opacity-100 ${
        liked ? "text-accent opacity-100" : "text-content-secondary opacity-0 group-hover/actor:opacity-100"
      }`}
    >
      <Heart weight={liked ? "fill" : "regular"} size={13} aria-hidden />
    </button>
  );
}
