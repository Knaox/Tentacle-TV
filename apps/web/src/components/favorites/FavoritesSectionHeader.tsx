import { memo } from "react";
import { useTranslation } from "react-i18next";
import { CaretDownIcon as ChevronDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { favoritesGroupLabel, type FavoritesGroup } from "@tentacle-tv/api-client";

/** Le libellé traduit d'une section — partagé par la grille du bureau et le miroir. */
export function useFavoritesGroupTitle() {
  const { t } = useTranslation("favorites");
  return (group: FavoritesGroup) => {
    const label = favoritesGroupLabel(group);
    return "text" in label ? label.text : t(label.key, label.params);
  };
}

/**
 * L'en-tête d'une section : son titre en Bricolage, son compte en puce neutre, un filet, et
 * le chevron qui replie la section. Un vrai bouton (`aria-expanded`), toute la ligne
 * cliquable. Pas d'`aria-controls` : les rangées d'une section sont virtualisées, il n'y a
 * pas UN élément à désigner. Plus de filet de marque devant le titre ni de compte violet : le
 * dégradé ne sert qu'à lire et à mesurer. Le chevron tourne par `transform` — la seule
 * propriété animée.
 */
export const FavoritesSectionHeader = memo(function FavoritesSectionHeader({
  title, count, collapsed, onToggle, first = false,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  /** La première section colle au haut de la grille. */
  first?: boolean;
}) {
  return (
    <h2 className={`pb-3 ${first ? "pt-0" : "pt-6"}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="group flex w-full cursor-pointer items-center gap-3 rounded-field py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
      >
        <span className="truncate text-heading-2 text-content-primary">{title}</span>
        <span className="chip shrink-0 tabular-nums">{count}</span>
        <span aria-hidden className="h-px flex-1 bg-line-subtle" />
        <ChevronDown
          aria-hidden
          size={18}
          className={`shrink-0 text-content-tertiary transition-[transform,color] duration-hover ease-out group-hover:text-content-primary ${collapsed ? "-rotate-90" : ""}`}
        />
      </button>
    </h2>
  );
});
