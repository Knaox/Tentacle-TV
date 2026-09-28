import { memo, useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

export interface RailTitle {
  key: string;
  title: string;
  caption: string;
  /** Pastille sous le titre (« Vu 2 fois »). */
  chip?: string;
  imageUrl: string | null;
  /** Ouverture de la fiche ; absente pour un titre qu'on ne sait pas ouvrir. */
  onPress?: () => void;
}

interface Props {
  items: RailTitle[];
  /** Rang en grands chiffres à gauche de l'affiche (« Top »). */
  ranked?: boolean;
  /** Largeur d'une affiche (plus large sur tablette). */
  posterWidth: number;
  /** Marge latérale de l'écran : la rangée déborde jusqu'aux bords. */
  inset: number;
}

/**
 * Une rangée d'affiches qui défile à l'horizontale : titre, légende et, pour
 * un classement, le rang en grands chiffres calé sur le bas de l'affiche.
 * Liste virtualisée, cartes mémorisées, clés stables.
 */
export const TitleRail = memo(function TitleRail({ items, ranked, posterWidth, inset }: Props) {
  const st = useThemedStyles(makeStyles);
  const renderItem = useCallback(
    ({ item, index }: { item: RailTitle; index: number }) => (
      <RailCard item={item} rank={ranked ? index + 1 : undefined} posterWidth={posterWidth} />
    ),
    [ranked, posterWidth]
  );
  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: inset, gap: spacing.md }}
      style={[st.list, { marginHorizontal: -inset }]}
    />
  );
});

const RailCard = memo(function RailCard({ item, rank, posterWidth }: { item: RailTitle; rank?: number; posterWidth: number }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const posterHeight = Math.round(posterWidth * 1.5);
  return (
    <Pressable
      onPress={item.onPress}
      disabled={!item.onPress}
      accessibilityRole={item.onPress ? "button" : undefined}
      accessibilityLabel={`${rank ? `${rank}. ` : ""}${item.title}, ${item.caption}${item.chip ? `, ${item.chip}` : ""}`}
      style={({ pressed }) => [st.card, pressed && st.pressed]}
    >
      <View style={st.top}>
        {rank !== undefined ? (
          <View style={[st.rankBox, { height: posterHeight }]}>
            <Text style={[st.rank, { color: withAlpha(theme.colors.brand.light, 0.55, theme.colors.brand.light) }]}>{rank}</Text>
          </View>
        ) : null}
        <View style={[st.poster, { width: posterWidth, height: posterHeight }]}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={item.key} />
          ) : (
            <Feather name="film" size={26} color={theme.colors.text.quaternary} />
          )}
        </View>
      </View>
      <View style={{ width: posterWidth, marginLeft: rank !== undefined ? st.rankBox.width - 10 : 0 }}>
        <Text style={st.title} numberOfLines={2}>{item.title}</Text>
        <Text style={st.caption} numberOfLines={1}>{item.caption}</Text>
        {item.chip ? <Text style={[st.chip, { color: theme.colors.brand.light, backgroundColor: theme.colors.brand.ghost }]}>{item.chip}</Text> : null}
      </View>
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    list: { flexGrow: 0 },
    card: {},
    pressed: { opacity: 0.7 },
    top: { flexDirection: "row", alignItems: "flex-end" },
    rankBox: { width: 44, justifyContent: "flex-end", marginRight: -10 },
    rank: { fontSize: 64, lineHeight: 60, fontFamily: FONT_FAMILY.extrabold, letterSpacing: -2, textAlign: "right" },
    poster: {
      borderRadius: RADIUS.lg,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.soft,
    },
    title: { marginTop: 8, fontSize: 14, lineHeight: 18, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    caption: { marginTop: 2, fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary, fontVariant: ["tabular-nums"] },
    chip: {
      alignSelf: "flex-start",
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: RADIUS.pill,
      overflow: "hidden",
      fontSize: 11,
      fontFamily: FONT_FAMILY.semibold,
    },
  });
