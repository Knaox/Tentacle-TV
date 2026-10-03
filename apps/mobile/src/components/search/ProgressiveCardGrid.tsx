import { memo } from "react";
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { useProgressiveCount } from "@/components/episodes/useProgressiveCount";
import { useGrid } from "@/theme";

/** Sous l'affiche d'une carte : titre, ligne secondaire et marge. */
const CARD_TEXT_HEIGHT = 56;

interface Props {
  items: readonly MediaItem[];
  /** L'appui : la carte rend son titre — une fonction stable. */
  onPress: (item: MediaItem) => void;
  /** Une autre liste (nouvelle requête, autre genre) : repartir du premier lot. */
  resetKey: string;
  /** La marge latérale, quand la page en porte déjà une (filmographie). */
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Une grille de cartes DANS le défilement de sa page (recherche, parcours
 * d'un genre, filmographie) : sans virtualisation possible, elle se monte
 * par lots (`useProgressiveCount`). Le premier écran, et une rangée de plus,
 * tout de suite ; la suite une image d'animation après l'autre. Jusqu'à 120
 * cartes d'un seul rendu figeaient le fil JS à l'ouverture d'un genre.
 */
export const ProgressiveCardGrid = memo(function ProgressiveCardGrid({ items, onPress, resetKey, padding, style }: Props) {
  const grid = useGrid({ phoneColumns: 3, gutter: 12 });
  const { height } = useWindowDimensions();
  const firstBatch = grid.numColumns * (Math.ceil(height / (grid.itemWidth * 1.5 + CARD_TEXT_HEIGHT)) + 1);
  const mounted = useProgressiveCount(items.length, resetKey, -1, firstBatch);
  return (
    <View style={[st.grid, { paddingHorizontal: padding ?? grid.padding, gap: grid.gutter }, style]}>
      {items.slice(0, mounted).map((item) => (
        <View key={item.Id} style={{ width: grid.itemWidth }}>
          <MobileMediaCard item={item} width={grid.itemWidth} onPress={onPress} />
        </View>
      ))}
    </View>
  );
});

const st = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap" },
});
