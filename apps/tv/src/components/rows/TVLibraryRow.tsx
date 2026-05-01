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
  renderCard: (item: MediaItem) => React.ReactNode;
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
  renderCard,
  onItemPress,
  onItemFocus,
  onLayout,
  onRowFocus,
}: TVLibraryRowProps) {
  const { data } = useLatestItems(libraryId);
  const { t } = useTranslation("common");

  if (!data || data.length === 0) return null;

  return (
    <FocusableRow
      title={t("latestAdditions", { name: libraryName })}
      data={data}
      renderItem={renderCard}
      keyExtractor={(item) => item.Id}
      itemWidth={TV_POSTER_WIDTH.md}
      style={{ marginTop: Spacing.sectionGap }}
      onItemPress={onItemPress}
      onItemFocus={onItemFocus}
      onLayout={onLayout}
      onRowFocus={onRowFocus}
    />
  );
}
