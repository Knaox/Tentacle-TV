import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSearchBrowse, type SearchBrowseTarget } from "@tentacle-tv/api-client";
import type { SearchPersonHit } from "@tentacle-tv/shared";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { BrandSpinner } from "@/components/ui";
import { FONT_FAMILY, RADIUS, spacing, useGrid, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { PersonAvatar } from "./SearchPeople";
import { asMediaItem } from "./SearchSection";

/** Ce que l'on parcourt : une personne (sa filmographie), un genre, un studio. */
export type BrowseTarget =
  | { kind: "person"; id: string; person: SearchPersonHit }
  | { kind: "genre"; name: string }
  | { kind: "studio"; name: string };

function query(target: BrowseTarget): SearchBrowseTarget {
  return target.kind === "person" ? { kind: "person", id: target.id } : target;
}

/**
 * Parcourir depuis la recherche — une personne, un genre, un studio — sans
 * quitter la recherche : l'en-tête dit ce qu'on parcourt et combien de titres
 * la bibliothèque en a, « Retour » ramène aux résultats, la requête intacte.
 */
export const SearchBrowse = memo(function SearchBrowse({ target, onBack, onOpen }: {
  target: BrowseTarget;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation("search");
  const { t: tc } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { itemWidth, gutter, padding } = useGrid({ phoneColumns: 3, gutter: 12 });
  const { data, isPending } = useSearchBrowse(query(target));
  const title = target.kind === "person" ? target.person.name : target.name;
  const kicker = target.kind === "person" ? t("filmographyTitle") : t(target.kind);

  return (
    <View>
      <View style={st.head}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={tc("back")} hitSlop={6} style={({ pressed }) => [st.back, pressed && st.pressed]}>
          <Feather name="chevron-left" size={20} color={theme.colors.text.primary} />
        </Pressable>
        {target.kind === "person" && <PersonAvatar person={target.person} size={56} />}
        <View style={st.headText}>
          <Text style={st.kicker}>{kicker}</Text>
          <Text style={st.title} numberOfLines={2} accessibilityRole="header">{title}</Text>
          {data && <Text style={st.count}>{t("inLibrary", { count: data.total })}</Text>}
        </View>
      </View>

      {isPending && <View style={st.loading}><BrandSpinner /></View>}
      {data && (
        <>
          <Text style={[st.sort, { paddingHorizontal: padding }]}>{t("sortedByYear")}</Text>
          <View style={[st.grid, { paddingHorizontal: padding, gap: gutter }]}>
            {data.items.map((hit) => (
              <View key={hit.item.Id} style={{ width: itemWidth }}>
                <MobileMediaCard item={asMediaItem(hit.item)} width={itemWidth} onPress={() => onOpen(hit.item.Id)} />
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    head: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.md,
      paddingHorizontal: spacing.screenPadding,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    back: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.pill,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: t.colors.fill.soft,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    pressed: { opacity: 0.7 },
    headText: { flex: 1, gap: 2 },
    kicker: { fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" as const, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.tertiary },
    title: { fontSize: 22, lineHeight: 27, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, letterSpacing: -0.4 },
    count: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    loading: { paddingVertical: spacing.xxl, alignItems: "center" as const },
    sort: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.quaternary, marginBottom: spacing.sm },
    grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, paddingBottom: spacing.xl },
  });
