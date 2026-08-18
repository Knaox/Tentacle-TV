import { useTranslation } from "react-i18next";
import type { LayoutChangeEvent } from "react-native";
import { useLatestItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FocusableRow } from "../focus/FocusableRow";
import { TV_POSTER_WIDTH } from "../cards/cardSizes";
import { Spacing } from "../../theme/colors";

interface TVLibraryRowProps {
  libraryId: string;
  libraryName: string;
  /** Type Jellyfin de la bibliothèque — "tvshows" active le groupage d'épisodes (+N), comme le web. */
  collectionType?: string;
  renderCard: (item: MediaItem, index: number, focused: boolean) => React.ReactNode;
  onItemPress: (item: MediaItem) => void;
  onItemFocus?: (item: MediaItem) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onRowFocus?: () => void;
}

/**
 * Library row for the home screen — pulls "latest" items for a single library
 * and renders them as a horizontal focusable row.
 *
 * Extracted from HomeScreen.tsx to keep the screen file under the 300-line
 * project budget.
 */
export function TVLibraryRow({
  libraryId,
  libraryName,
  collectionType,
  renderCard,
  onItemPress,
  onItemFocus,
  onLayout,
  onRowFocus,
}: TVLibraryRowProps) {
  const { data } = useLatestItems(libraryId, { collectionType });
  const { t } = useTranslation("common");

  if (!data || data.length === 0) return null;

  // Le groupage par runs peut produire DEUX groupes de la même série (runs
  // non contigus) → Id identique = clés React dupliquées. On garde le premier.
  const seen = new Set<string>();
  const items = data.filter((it) => {
    if (seen.has(it.Id)) return false;
    seen.add(it.Id);
    return true;
  });

  return (
    <FocusableRow
      title={t("latestAdditions", { name: libraryName })}
      data={items}
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
