import { memo, useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { ReasonChips, type ReasonChip } from "./ReasonChips";

export interface RailTitle {
  key: string;
  title: string;
  caption: string;
  /** Les avis du titre (note, coup de cœur, favori…), sous la légende. */
  chips?: ReasonChip[];
  imageUrl: string | null;
  /** Ouverture de la fiche ; absente pour un titre qu'on ne sait pas ouvrir. */
  onPress?: () => void;
}

interface Props {
  items: RailTitle[];
  /** Rang du premier titre, pour un classement ; absent : pas de rang. */
  firstRank?: number;
  /** Largeur d'une affiche (plus large sur tablette). */
  posterWidth: number;
  /** Marge latérale de l'écran : la rangée déborde jusqu'aux bords. */
  inset: number;
}

/**
 * Une rangée d'affiches qui défile à l'horizontale : titre, légende, avis
 * et, pour un classement, le rang en petite pastille sur l'affiche — un
 * repère, pas un chiffre géant. Liste virtualisée, cartes mémorisées, clés
 * stables.
 */
export const TitleRail = memo(function TitleRail({ items, firstRank, posterWidth, inset }: Props) {
  const st = useThemedStyles(makeStyles);
  const renderItem = useCallback(
    ({ item, index }: { item: RailTitle; index: number }) => (
      <RailCard item={item} rank={firstRank !== undefined ? firstRank + index : undefined} posterWidth={posterWidth} />
    ),
    [firstRank, posterWidth]
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
  const { t } = useTranslation("stats");
  const label = [rank !== undefined ? t("rank", { rank }) : null, item.title, item.caption, ...(item.chips ?? []).map((c) => c.accessibilityLabel ?? c.label)]
    .filter(Boolean)
    .join(", ");
  return (
    <Pressable
      onPress={item.onPress}
      disabled={!item.onPress}
      accessibilityRole={item.onPress ? "button" : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [{ width: posterWidth }, pressed && st.pressed]}
    >
      <View style={[st.poster, { width: posterWidth, height: Math.round(posterWidth * 1.5) }]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={item.key} />
        ) : (
          <Feather name="film" size={26} color={theme.colors.text.quaternary} />
        )}
        {rank !== undefined ? (
          <View style={st.rank}>
            <Text style={st.rankTxt}>{rank}</Text>
          </View>
        ) : null}
      </View>
      <Text style={st.title} numberOfLines={2}>{item.title}</Text>
      {item.caption ? <Text style={st.caption} numberOfLines={1}>{item.caption}</Text> : null}
      {item.chips && item.chips.length > 0 ? <View style={st.chips}><ReasonChips chips={item.chips} /></View> : null}
    </Pressable>
  );
});

// La pastille de rang est posée SUR l'affiche : noir et blanc constants dans les deux
// thèmes, comme le badge de note des cartes.
const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    list: { flexGrow: 0 },
    pressed: { opacity: 0.7 },
    poster: {
      borderRadius: RADIUS.lg,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.soft,
    },
    rank: {
      position: "absolute",
      top: 6,
      left: 6,
      minWidth: 24,
      height: 24,
      paddingHorizontal: 6,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.2)",
      backgroundColor: "rgba(0,0,0,0.7)",
    },
    rankTxt: { fontSize: 12, fontFamily: FONT_FAMILY.semibold, color: "#FFFFFF", fontVariant: ["tabular-nums"] },
    title: { marginTop: 8, fontSize: 14, lineHeight: 18, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    caption: { marginTop: 2, fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary, fontVariant: ["tabular-nums"] },
    chips: { marginTop: 6 },
  });
