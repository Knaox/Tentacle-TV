import { memo, useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FavoritesGroup } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useFavoritesGroupTitle } from "../../../components/favorites/FavoritesSectionHeader";
import { useGrid } from "../../useMirrorLayout";
import { SelectableGridCard } from "../collection/SelectableGridCard";

interface FavoritesGridProps {
  groups: FavoritesGroup[];
  isSelecting: boolean;
  selected: ReadonlySet<string>;
  onPress: (item: MediaItem) => void;
  onLongPress: (item: MediaItem) => void;
}

/**
 * La grille de Mes favoris (`favorites/FavoritesGrid` de l'app) : les
 * mesures de Ma liste (3 colonnes au téléphone, `useGrid` sur tablette,
 * gouttière 8, 12 entre rangées), découpée en sections quand un regroupement
 * est choisi. En-tête de section : filet de marque, titre 17 gras, compte en
 * pastille, chevron qui replie — 44 de haut, toute la ligne se touche.
 * Sans regroupement, une seule section, sans en-tête.
 */
export const FavoritesGrid = memo(function FavoritesGrid({ groups, isSelecting, selected, onPress, onLongPress }: FavoritesGridProps) {
  const title = useFavoritesGroupTitle();
  const { numColumns, itemWidth, gutter, padding } = useGrid({ phoneColumns: 3 });
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <div style={{ paddingBottom: isSelecting ? 132 : 0 }}>
      {groups.map((group, gi) => {
        const isCollapsed = collapsed.has(group.key);
        const headed = group.mode !== "none";
        return (
          <section key={group.key} aria-label={headed ? title(group) : undefined}>
            {headed && (
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={!isCollapsed}
                className={`flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left active:opacity-80 ${gi === 0 ? "" : "mt-4"}`}
              >
                <span aria-hidden className="h-[18px] w-[3px] shrink-0 rounded-full" style={{ background: "linear-gradient(180deg, var(--brand-light), var(--brand-accent))" }} />
                <span className="truncate text-[17px] font-bold tracking-[-0.3px] text-content-primary">{title(group)}</span>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-light" style={{ background: "var(--brand-soft)" }}>
                  {group.items.length}
                </span>
                <span className="flex-1" />
                <ChevronDown
                  size={18}
                  aria-hidden
                  className={`shrink-0 text-content-tertiary transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                />
              </button>
            )}
            {!isCollapsed && (
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${numColumns}, ${itemWidth}px)`,
                  columnGap: gutter,
                  rowGap: 12,
                  paddingLeft: padding,
                  paddingRight: padding,
                  paddingTop: headed ? 4 : 0,
                }}
              >
                {group.items.map((item) => (
                  <SelectableGridCard
                    key={item.Id}
                    item={item}
                    width={itemWidth}
                    selectable={isSelecting}
                    selected={selected.has(item.Id)}
                    onPress={() => onPress(item)}
                    onLongPress={() => onLongPress(item)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
});
