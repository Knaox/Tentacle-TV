import { useCallback } from "react";
import { FlatList, View } from "react-native";
import { useTranslation } from "react-i18next";
import { RowHeader } from "@/components/RowHeader";
import type { OfflineEntry } from "@/offline/engineApi";
import { spacing, useResponsive } from "@/theme";
import { OfflineResumeCard } from "./OfflineResumeCard";

interface Props {
  entries: readonly OfflineEntry[];
  onPlay: (entry: OfflineEntry) => void;
  onMore: (entry: OfflineEntry) => void;
}

const CARD_W_PHONE = 232;
const CARD_W_TABLET = 300;

/** La rangée « Reprendre » : des cartes 16:9 à l'image exacte, en défilement horizontal. */
export function OfflineResumeRail({ entries, onPlay, onMore }: Props) {
  const { t } = useTranslation("common");
  const { isTablet } = useResponsive();
  const width = isTablet ? CARD_W_TABLET : CARD_W_PHONE;
  const renderItem = useCallback(
    ({ item }: { item: OfflineEntry }) => <OfflineResumeCard entry={item} width={width} onPress={onPlay} onLongPress={onMore} />,
    [width, onPlay, onMore],
  );
  return (
    <View style={{ marginTop: spacing.xxl }}>
      <RowHeader title={t("resumeWatching")} />
      <FlatList
        horizontal
        data={entries as OfflineEntry[]}
        keyExtractor={(entry) => String(entry.id)}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: 14 }}
        decelerationRate="fast"
      />
    </View>
  );
}
