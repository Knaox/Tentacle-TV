import { memo } from "react";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { LayoutChangeEvent } from "react-native";
import { recoRowTitle, type RecoRowItem } from "@tentacle-tv/api-client";
import type { TvRecoShelf } from "@tentacle-tv/tv-core";
import { FocusableRow } from "../focus/FocusableRow";
import { TVRecoCard } from "../cards/TVRecoCard";
import { TV_POSTER_WIDTH } from "../cards/cardSizes";
import { TVRecoFilterChip } from "./TVRecoFilterChip";
import { Colors, Spacing, Typography } from "../../theme/colors";

const renderCard = (item: RecoRowItem, _i: number, focused: boolean) => <TVRecoCard item={item} focused={focused} />;
const keyOf = (item: RecoRowItem) => item.key;

interface TVRecoShelvesListProps {
  shelves: TvRecoShelf<RecoRowItem>[];
  onPress: (item: RecoRowItem) => void;
  onLongPress: (item: RecoRowItem) => void;
  onItemFocus: (item: RecoRowItem) => void;
  onShelfLayout: (key: string, y: number) => void;
  onShelfFocus: (key: string) => void;
}

/**
 * Les étagères de la page « Pour vous » — celles de `tvRecoShelves`, dans
 * l'ordre du moteur. La première porte la pastille du filtre de plateformes
 * du compte quand il est actif : un appui le retire, sans quitter la page.
 */
export const TVRecoShelvesList = memo(function TVRecoShelvesList({
  shelves, onPress, onLongPress, onItemFocus, onShelfLayout, onShelfFocus,
}: TVRecoShelvesListProps) {
  const { t } = useTranslation("reco");
  return (
    <>
      {shelves.map((shelf, index) => {
        const { key, params } = recoRowTitle(shelf);
        return (
          <FocusableRow
            key={shelf.key}
            title={t(key, params)}
            titleAccessory={index === 0 ? <TVRecoFilterChip /> : undefined}
            data={shelf.items}
            renderItem={renderCard}
            keyExtractor={keyOf}
            itemWidth={TV_POSTER_WIDTH.md}
            style={{ marginBottom: Spacing.rowGap }}
            onItemPress={onPress}
            onItemLongPress={onLongPress}
            onItemFocus={onItemFocus}
            onLayout={(e: LayoutChangeEvent) => onShelfLayout(shelf.key, e.nativeEvent.layout.y)}
            onRowFocus={() => onShelfFocus(shelf.key)}
          />
        );
      })}
    </>
  );
});

/** La phrase d'état au-dessus des étagères (désactivé, à froid, en préparation, vide). */
export function TVRecoNoticeLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <Text style={{
      color: Colors.textSecondary, ...Typography.body, fontSize: 18,
      paddingHorizontal: Spacing.rowGutter, marginBottom: 24, maxWidth: 1100,
    }}>
      {text}
    </Text>
  );
}
