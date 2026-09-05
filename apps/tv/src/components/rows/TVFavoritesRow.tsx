import { useTranslation } from "react-i18next";
import type { LayoutChangeEvent } from "react-native";
import { useFavorites } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FocusableRow } from "../focus/FocusableRow";
import { TV_POSTER_WIDTH } from "../cards/cardSizes";
import { Spacing } from "../../theme/colors";

interface TVFavoritesRowProps {
  renderCard: (item: MediaItem, index: number, focused: boolean) => React.ReactNode;
  onItemPress: (item: MediaItem) => void;
  onItemFocus?: (item: MediaItem) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onRowFocus?: () => void;
}

/** « Mes favoris » — les vingt derniers favoris (films et séries), en
 *  affiches. S'alimente seule (aucune requête si la rangée est éteinte) ;
 *  rien sans favori. Motif de TVLibraryRow. */
export function TVFavoritesRow({ renderCard, onItemPress, onItemFocus, onLayout, onRowFocus }: TVFavoritesRowProps) {
  const { t } = useTranslation("common");
  const { data } = useFavorites();
  if (!data || data.length === 0) return null;
  return (
    <FocusableRow
      title={t("myFavorites")}
      data={data}
      renderItem={renderCard}
      keyExtractor={(item) => item.Id}
      itemWidth={TV_POSTER_WIDTH.md}
      style={{ marginBottom: Spacing.rowGap }}
      onItemPress={onItemPress}
      onItemFocus={onItemFocus}
      onLayout={onLayout}
      onRowFocus={onRowFocus}
    />
  );
}
