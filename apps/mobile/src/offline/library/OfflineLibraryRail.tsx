import { memo, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { GradientOverlay, PressableCard } from "@/components/ui";
import { spacing, FONT_FAMILY, RADIUS, SHADOW_RN, useResponsive, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { BANNER_ART, resolveLocalArt } from "./offlineArt";
import { ALL_LIBRARIES, type OfflineCatalogFilter, type OfflineCatalogLibrary } from "./useOfflineCatalog";

type FeatherName = keyof typeof Feather.glyphMap;

/** L'icône du type de collection Jellyfin — la même table que la carte de bibliothèque en ligne. */
function iconFor(type: string | null): FeatherName {
  switch (type?.toLowerCase()) {
    case "movies": return "film";
    case "tvshows": return "tv";
    case "music": return "music";
    case "books": return "book";
    default: return "layers";
  }
}

interface Tile {
  id: OfflineCatalogFilter;
  label: string;
  count: number;
  icon: FeatherName;
  /** L'image locale de la tuile ; `null` : dégradé de marque (« Tout ») ou aplat. */
  art: string | null;
  all: boolean;
}

interface Props {
  libraries: OfflineCatalogLibrary[];
  /** Films + séries de l'appareil, pour la tuile « Tout ». */
  total: number;
  filter: OfflineCatalogFilter;
  onFilter: (value: OfflineCatalogFilter) => void;
}

/**
 * Le filtre du catalogue hors ligne : une rangée de TUILES 16:9, une par
 * vraie bibliothèque Jellyfin de l'appareil (Films, Séries, Animés…), dans le
 * dessin de la carte de bibliothèque en ligne — bannière d'un titre local,
 * fondu bas, badge d'icône, nom en gras, compte. « Tout » ouvre la rangée sur
 * un dégradé de marque. La tuile active porte l'anneau violet, les autres
 * s'estompent ; la rangée défile, la suivante dépasse toujours un peu.
 */
export function OfflineLibraryRail({ libraries, total, filter, onFilter }: Props) {
  const { t } = useTranslation(["downloads", "common"]);
  const { isTablet } = useResponsive();
  const st = useThemedStyles(makeStyles);
  const width = isTablet ? 200 : 156;
  const tiles = useMemo<Tile[]>(
    () => [
      { id: ALL_LIBRARIES, label: t("downloads:filterAll"), count: total, icon: "grid", art: null, all: true },
      ...libraries.map((library) => ({
        id: library.id,
        label: library.label,
        count: library.count,
        icon: iconFor(library.type),
        art: library.artItemId ? resolveLocalArt(library.artItemId, BANNER_ART) : null,
        all: false,
      })),
    ],
    [libraries, total, t],
  );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={t("downloads:filterAll")}
    >
      {tiles.map((tile) => (
        <LibraryTile key={tile.id} tile={tile} width={width} active={tile.id === filter} onPress={() => onFilter(tile.id)} />
      ))}
    </ScrollView>
  );
}

interface TileProps { tile: Tile; width: number; active: boolean; onPress: () => void }

const LibraryTile = memo(function LibraryTile({ tile, width, active, onPress }: TileProps) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const { colors } = theme;
  const st = useThemedStyles(makeStyles);
  const countLabel = t("libraryTitles", { count: tile.count });
  return (
    <PressableCard
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${tile.label}, ${countLabel}`}
      style={{ width }}
    >
      {/* Fond posé dès le départ (Fabric perd le rayon d'un fond qui apparaît). */}
      <View style={[st.tile, { width }, active ? st.tileActive : st.tileIdle]}>
        {tile.all ? (
          <LinearGradient colors={[colors.brand.violet, colors.brand.glow]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        ) : tile.art ? (
          <Image source={{ uri: tile.art }} cachePolicy="none" style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        ) : (
          <View style={st.fallback}>
            <Feather name={tile.icon} size={28} color={colors.text.disabled} />
          </View>
        )}
        {!tile.all && (
          <GradientOverlay direction="bottom" height="70%" intensity="strong" color={theme.isDark ? undefined : `rgb(${colors.onMedia.scrimRgb})`} />
        )}
        <View style={st.badge} collapsable={false}>
          <Feather name={tile.icon} size={12} color={colors.cta.brandFg} />
        </View>
        <View style={st.labels}>
          <Text style={st.name} numberOfLines={1} maxFontSizeMultiplier={1.2}>{tile.label}</Text>
          <Text style={st.count} numberOfLines={1}>{countLabel}</Text>
        </View>
      </View>
    </PressableCard>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { paddingHorizontal: spacing.screenPadding, gap: spacing.sm, paddingVertical: 4 },
    tile: {
      aspectRatio: 16 / 9,
      borderRadius: RADIUS.lg,
      overflow: "hidden",
      backgroundColor: t.colors.surface.s2,
      borderWidth: 2,
    },
    tileActive: { borderColor: t.colors.brand.violet, ...SHADOW_RN.elev3 },
    tileIdle: { borderColor: withAlpha(t.colors.border.subtle, 0.6, t.colors.border.subtle), opacity: 0.78 },
    fallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surface.s2 },
    badge: {
      position: "absolute",
      top: 8,
      left: 8,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: t.colors.glass.backdrop,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withAlpha(t.colors.cta.brandFg, 0.18, t.colors.border.strong),
      alignItems: "center",
      justifyContent: "center",
    },
    labels: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
    name: {
      fontSize: 15,
      fontFamily: FONT_FAMILY.extrabold,
      color: t.colors.onMedia.primary,
      letterSpacing: -0.3,
      textShadowColor: t.colors.onMedia.shadow,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    count: {
      fontSize: 11,
      fontFamily: FONT_FAMILY.medium,
      color: t.colors.onMedia.secondary,
      marginTop: 1,
      textShadowColor: t.colors.onMedia.shadow,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
  });
