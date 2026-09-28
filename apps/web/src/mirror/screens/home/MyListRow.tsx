import { memo, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaRow } from "../../rows/MediaRow";

const keyOf = (item: MediaItem) => item.Id;

/**
 * `MyListRow` de l'app : « À regarder », dédoublonnée, « Voir tout » vers Ma
 * liste. Ses cartes sont celles de toutes les rangées (`MediaCard`) : une
 * carte maison, sans note ni pastille d'états, s'y lisait comme une autre
 * application.
 */
export const MyListRow = memo(function MyListRow({ items, onSeeAll, renderCard }: {
  items: MediaItem[];
  onSeeAll: () => void;
  renderCard: (item: MediaItem) => ReactNode;
}) {
  const { t } = useTranslation("common");
  const unique = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.Id)) return false;
      seen.add(item.Id);
      return true;
    });
  }, [items]);

  return <MediaRow title={t("toWatch")} data={unique} keyOf={keyOf} onSeeAll={onSeeAll} renderItem={renderCard} />;
});
