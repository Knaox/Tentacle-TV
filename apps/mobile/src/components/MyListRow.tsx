import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaRow } from "@/components/MediaRow";

interface Props {
  personalItems: MediaItem[];
  onSeeAll: () => void;
  /** La carte de l'accueil (`MobileMediaCard`) — la même que toutes les rangées. */
  renderCard: (item: MediaItem) => React.ReactNode;
}

/**
 * Carrousel « À regarder » de l'accueil — Ma liste, dédoublonnée. Une rangée
 * comme les autres : même en-tête (`RowHeader`), même carte que toutes les
 * rangées — marqueurs communs, repli d'affiche, appui long. Elle avait sa
 * propre affiche, sa propre coche « vu » et son propre appui long, et
 * divergeait de ses voisines à chaque évolution des cartes.
 */
export function MyListRow({ personalItems, onSeeAll, renderCard }: Props) {
  const { t } = useTranslation("common");
  const items = useMemo(() => {
    const seen = new Set<string>();
    return personalItems.filter((item) => {
      if (seen.has(item.Id)) return false;
      seen.add(item.Id);
      return true;
    });
  }, [personalItems]);

  if (items.length === 0) return null;
  return <MediaRow title={t("toWatch")} data={items} renderItem={renderCard} onSeeAll={onSeeAll} />;
}
