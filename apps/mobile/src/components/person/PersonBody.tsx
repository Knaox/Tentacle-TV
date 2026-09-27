import { memo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  biographyParagraphs, creditRoleKey, type CreditRole, type FilmographyEntry, type FilmographyFacets,
  type FilmographyKind, type SearchMediaItem,
} from "@tentacle-tv/shared";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { BrandSpinner } from "@/components/ui";
import { asMediaItem } from "@/components/search/SearchSection";
import { FONT_FAMILY, RADIUS, spacing, useGrid, useThemedStyles, type AppTheme } from "@/theme";

/** La biographie, repliée sur six lignes ; « Voir plus » seulement si elle a été coupée. */
export const PersonBio = memo(function PersonBio({ overview }: { overview: string | undefined }) {
  const { t } = useTranslation(["media", "common"]);
  const st = useThemedStyles(makeStyles);
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const paragraphs = biographyParagraphs(overview);
  if (paragraphs.length === 0) return null;

  return (
    <View style={st.block}>
      <Text style={st.sectionTitle} accessibilityRole="header">{t("media:personBiography")}</Text>
      <Text
        style={st.bio}
        numberOfLines={expanded ? undefined : 6}
        onTextLayout={(e) => { if (!expanded && e.nativeEvent.lines.length >= 6) setTruncated(true); }}
      >
        {paragraphs.join("\n\n")}
      </Text>
      {(truncated || expanded) && (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8} accessibilityRole="button">
          <Text style={st.more}>{expanded ? t("common:showLess") : t("common:showMore")}</Text>
        </Pressable>
      )}
    </View>
  );
});

interface FilmographyProps {
  pending: boolean;
  entries: FilmographyEntry<SearchMediaItem>[];
  shown: FilmographyEntry<SearchMediaItem>[];
  facets: FilmographyFacets;
  kind: FilmographyKind;
  role: CreditRole | null;
  onKind: (kind: FilmographyKind) => void;
  onRole: (role: CreditRole | null) => void;
  onOpen: (id: string) => void;
}

/**
 * « Dans la bibliothèque » : les pastilles (films / séries, puis le métier —
 * chaque rangée seulement si elle départage quelque chose) et la grille.
 */
export const PersonFilmography = memo(function PersonFilmography(props: FilmographyProps) {
  const { pending, entries, shown, facets, kind, role, onKind, onRole, onOpen } = props;
  const { t } = useTranslation("media");
  const st = useThemedStyles(makeStyles);
  const { itemWidth, gutter, padding } = useGrid({ phoneColumns: 3, gutter: 12 });
  const showKinds = facets.movies > 0 && facets.series > 0;
  const showRoles = facets.roles.length > 1;

  return (
    <View style={st.block}>
      <Text style={st.sectionTitle} accessibilityRole="header">{t("personInLibraryTitle")}</Text>
      {(showKinds || showRoles) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips} style={st.chipsScroll}>
          {showKinds && (
            <>
              <Chip label={t("personFilterAll")} count={facets.total} active={kind === "all"} onPress={() => onKind("all")} />
              <Chip label={t("personFilterMovies")} count={facets.movies} active={kind === "movie"} onPress={() => onKind("movie")} />
              <Chip label={t("personFilterSeries")} count={facets.series} active={kind === "series"} onPress={() => onKind("series")} />
            </>
          )}
          {showKinds && showRoles && <View style={st.chipSep} />}
          {showRoles && facets.roles.map((r) => (
            <Chip
              key={r.role}
              label={t(creditRoleKey(r.role))}
              count={r.count}
              active={role === r.role}
              onPress={() => onRole(role === r.role ? null : r.role)}
            />
          ))}
        </ScrollView>
      )}
      {pending && <View style={st.loading}><BrandSpinner /></View>}
      {!pending && entries.length === 0 && <Text style={st.empty}>{t("personLibraryEmpty")}</Text>}
      {!pending && entries.length > 0 && shown.length === 0 && <Text style={st.empty}>{t("personFilterEmpty")}</Text>}
      {shown.length > 0 && (
        <View style={[st.grid, { paddingHorizontal: padding - spacing.screenPadding, gap: gutter }]}>
          {shown.map(({ item }) => (
            <View key={item.Id} style={{ width: itemWidth }}>
              <MobileMediaCard item={asMediaItem(item)} width={itemWidth} onPress={() => onOpen(item.Id)} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

function Chip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [st.chip, active && st.chipOn, pressed && { opacity: 0.75 }]}
    >
      <Text style={[st.chipTxt, active && st.chipTxtOn]}>{label}</Text>
      <Text style={st.chipCount}>{count}</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    block: { paddingHorizontal: spacing.screenPadding, marginTop: spacing.xl },
    sectionTitle: { fontSize: 18, lineHeight: 23, letterSpacing: -0.4, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, marginBottom: spacing.sm },
    bio: { fontSize: 15, lineHeight: 22, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    more: { marginTop: spacing.sm, fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    chipsScroll: { marginHorizontal: -spacing.screenPadding, marginBottom: spacing.md },
    chips: { paddingHorizontal: spacing.screenPadding, gap: spacing.sm, alignItems: "center" },
    chipSep: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: t.colors.border.strong, marginHorizontal: 2 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
    },
    chipOn: { borderColor: t.colors.brand.violet, backgroundColor: t.colors.brand.soft },
    chipTxt: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    chipTxtOn: { color: t.colors.text.primary },
    chipCount: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.quaternary },
    loading: { paddingVertical: spacing.xxl, alignItems: "center" },
    empty: { paddingVertical: spacing.lg, fontSize: 14, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    grid: { flexDirection: "row", flexWrap: "wrap" },
  });
