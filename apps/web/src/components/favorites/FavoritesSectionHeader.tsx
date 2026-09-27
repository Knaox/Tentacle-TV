import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
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
 * L'en-tête d'une section : filet de marque, titre, compte, et le chevron qui
 * replie la section. Un vrai bouton (`aria-expanded`), toute la ligne cliquable. Pas d'`aria-controls` : les rangées d'une
 * section sont virtualisées, il n'y a pas UN élément à désigner.
 * Le chevron tourne par `transform` — la seule propriété animée.
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
        className="group flex w-full cursor-pointer items-center gap-3 rounded-xl py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
      >
        <span
          aria-hidden
          className="h-5 w-[3px] shrink-0 rounded-full"
          style={{ background: "linear-gradient(180deg, var(--brand-light), var(--brand-accent))" }}
        />
        <span className="truncate text-lg font-bold tracking-[-0.2px] text-content-primary md:text-xl">{title}</span>
        <span className="shrink-0 rounded-full bg-[rgba(var(--brand-rgb),0.16)] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--brand-light)]">
          {count}
        </span>
        <span aria-hidden className="h-px flex-1 bg-line-subtle" />
        <ChevronDown
          aria-hidden
          size={18}
          className={`shrink-0 text-content-tertiary transition-transform duration-200 group-hover:text-content-primary ${collapsed ? "-rotate-90" : ""}`}
        />
      </button>
    </h2>
  );
});
