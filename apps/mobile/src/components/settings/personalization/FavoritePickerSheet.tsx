import { useCallback } from "react";
import { View, Text, FlatList, StyleSheet, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useFavoritesAll, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { BottomSheet, PressableCard } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, RADIUS, SHEET_MAX_WIDTH, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const COLUMNS = 3;
const GUTTER = spacing.sm;
const NONE = "__none__";

interface Props {
  visible: boolean;
  onClose: () => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * Le titre fixe du bandeau, choisi parmi les favoris du compte : une grille
 * d'affiches en feuille, la tuile « Aucun titre » en tête pour retirer le
 * choix. Sans favori, le message qui explique quoi faire.
 */
export function FavoritePickerSheet({ visible, onClose, selectedId, onSelect }: Props) {
  const { t } = useTranslation("preferences");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const { width: windowW } = useWindowDimensions();
  const { data: favorites } = useFavoritesAll();
  // La feuille est bornée en largeur sur tablette : la grille se calcule dessus.
  const sheetW = Math.min(windowW, SHEET_MAX_WIDTH);
  const itemW = Math.floor((sheetW - spacing.lg * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS);

  const pick = useCallback((id: string | null) => { onSelect(id); onClose(); }, [onSelect, onClose]);
  const data: Array<MediaItem | typeof NONE> = [NONE, ...(favorites ?? [])];

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.7, 0.95]}>
      <View style={st.body}>
        <Text style={st.title}>{t("persoHeroFixedPick")}</Text>
        {favorites && favorites.length === 0 ? (
          <Text style={st.empty}>{t("persoHeroFixedEmpty")}</Text>
        ) : (
          <FlatList
            data={data}
            numColumns={COLUMNS}
            keyExtractor={(item) => (item === NONE ? NONE : item.Id)}
            columnWrapperStyle={{ gap: GUTTER }}
            contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isNone = item === NONE;
              const id = isNone ? null : item.Id;
              const selected = selectedId === id;
              return (
                <PressableCard
                  onPress={() => pick(id)}
                  style={{ width: itemW }}
                  accessibilityRole="radio"
                  accessibilityLabel={isNone ? t("persoHeroFixedNone") : item.Name}
                  accessibilityState={{ selected }}
                >
                  <View style={[st.poster, selected && st.posterSelected]}>
                    {isNone ? (
                      <View style={st.noneTile}>
                        <Feather name="slash" size={22} color={theme.colors.text.tertiary} />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: client.getImageUrl(item.Id, "Primary", { width: 300, quality: 80 }) }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={150}
                      />
                    )}
                  </View>
                  <Text style={st.name} numberOfLines={1}>{isNone ? t("persoHeroFixedNone") : item.Name}</Text>
                </PressableCard>
              );
            }}
          />
        )}
      </View>
    </BottomSheet>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.md },
  title: { ...typography.badge, fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary, letterSpacing: 0.8, textTransform: "uppercase" as const },
  empty: { ...typography.caption, color: t.colors.text.tertiary },
  poster: {
    aspectRatio: 2 / 3, borderRadius: RADIUS.lg, overflow: "hidden" as const,
    backgroundColor: t.colors.surface.s2, borderWidth: 2, borderColor: "transparent",
  },
  posterSelected: { borderColor: t.colors.brand.violet },
  noneTile: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: t.colors.fill.faint },
  name: { ...typography.small, fontFamily: FONT_FAMILY.medium, color: t.colors.text.primary, marginTop: 6 },
});
