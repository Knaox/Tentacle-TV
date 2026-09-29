import { memo, useCallback, useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type LayoutRectangle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { CARD_GLYPH_VIEWBOX, WATCHED_FILLED_PATH, type MediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, seasonTabGradient, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/** Ce qu'une pastille lit d'une saison — en ligne, ou gardée sur l'appareil. */
type SeasonPillItem = Pick<MediaItem, "Id" | "Name" | "RecursiveItemCount" | "ChildCount" | "UserData">;

interface Props {
  seasons: readonly SeasonPillItem[];
  activeSeasonId: string | undefined;
  onSelect: (seasonId: string) => void;
  /** La saison de l'épisode à reprendre (ou de l'épisode ouvert) : marquée d'un point. */
  markedSeasonId?: string;
  /** Le doigt se pose : de quoi précharger la saison avant même le relâché. */
  onIntent?: (seasonId: string) => void;
}

/** Marge sous laquelle une pastille collée au bord compte comme hors champ. */
const EDGE = 16;

/**
 * Les pastilles de saison — la grammaire du bureau (`SeasonTabs`) : verre
 * épais sous un libellé plein, lisible sur n'importe quel fond ; la saison
 * affichée en dégradé de marque profond ; un point pour la saison en cours, la
 * coche des cartes pour une saison vue, un compteur d'épisodes. Générique : la
 * fiche en ligne comme la vue d'une série gardée.
 *
 * La saison affichée est ramenée dans le champ à l'ouverture (la saison 14
 * d'une série de 22 n'est plus hors écran) et quand elle change hors champ.
 * Une vingtaine de pastilles au plus : une `ScrollView`, toutes montées, pour
 * connaître leur position sans virtualisation.
 */
export function SeasonPills({ seasons, activeSeasonId, onSelect, markedSeasonId, onIntent }: Props) {
  const st = useThemedStyles(makeStyles);
  const scrollRef = useRef<ScrollView>(null);
  const boxes = useRef(new Map<string, LayoutRectangle>());
  const viewport = useRef({ width: 0, x: 0, content: 0 });
  const placed = useRef(false);

  /**
   * La saison affichée au centre de la bande, si elle est hors champ. Rien
   * tant que la pastille, la bande ET la taille du contenu ne sont pas
   * connues : un `scrollTo` émis avant que le natif connaisse la largeur du
   * contenu est ramené à zéro, et la bande restait sur « Spéciaux ». On
   * réessaie donc à chaque mesure (pastille, bande, contenu).
   */
  const reveal = useCallback((animated: boolean): boolean => {
    const box = activeSeasonId ? boxes.current.get(activeSeasonId) : undefined;
    const { width, x, content } = viewport.current;
    if (!box || !width || content < box.x + box.width) return false;
    if (box.x >= x + EDGE && box.x + box.width <= x + width - EDGE) return true;
    const target = Math.min(Math.max(0, box.x - (width - box.width) / 2), Math.max(0, content - width));
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: target, animated }));
    return true;
  }, [activeSeasonId]);

  const tryPlace = useCallback(() => {
    if (!placed.current && reveal(false)) placed.current = true;
  }, [reveal]);

  // À l'ouverture d'un coup, ensuite en glissant.
  useEffect(() => {
    if (!placed.current) tryPlace();
    else reveal(true);
  }, [reveal, tryPlace]);

  const onPillLayout = useCallback((seasonId: string, layout: LayoutRectangle) => {
    boxes.current.set(seasonId, layout);
    if (seasonId === activeSeasonId) tryPlace();
  }, [activeSeasonId, tryPlace]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.list}
      accessibilityRole="tablist"
      scrollEventThrottle={32}
      onScroll={(e) => { viewport.current.x = e.nativeEvent.contentOffset.x; }}
      onLayout={(e) => {
        viewport.current.width = e.nativeEvent.layout.width;
        tryPlace();
      }}
      onContentSizeChange={(w) => {
        viewport.current.content = w;
        tryPlace();
      }}
    >
      {seasons.map((season) => (
        <SeasonPill
          key={season.Id}
          season={season}
          active={season.Id === activeSeasonId}
          marked={season.Id === markedSeasonId}
          onSelect={onSelect}
          onIntent={onIntent}
          onPillLayout={onPillLayout}
        />
      ))}
    </ScrollView>
  );
}

interface PillProps {
  season: SeasonPillItem;
  active: boolean;
  marked: boolean;
  onSelect: (seasonId: string) => void;
  onIntent?: (seasonId: string) => void;
  onPillLayout: (seasonId: string, layout: LayoutRectangle) => void;
}

const SeasonPill = memo(function SeasonPill({ season, active, marked, onSelect, onIntent, onPillLayout }: PillProps) {
  const { t } = useTranslation("common");
  const { colors, isDark } = useTheme();
  const st = useThemedStyles(makeStyles);
  const count = season.RecursiveItemCount ?? season.ChildCount;
  const watched = !marked && season.UserData?.Played === true && count !== 0;
  const status = marked ? t("seasonTabCurrent") : watched ? t("seasonTabWatched") : null;
  const label = [season.Name, count ? t("seasonTabEpisodes", { count }) : null, status].filter(Boolean).join(", ");
  const fg = active ? colors.cta.brandFg : colors.text.primary;
  const soft = active ? colors.cta.brandFg : colors.text.secondary;
  // L'accent clair tient 3:1 sur le verre sombre, l'accent profond sur le clair.
  const dot = active ? colors.cta.brandFg : isDark ? colors.brand.accentLight : colors.brand.accent;

  return (
    <Pressable
      onPress={() => onSelect(season.Id)}
      onPressIn={onIntent && !active ? () => onIntent(season.Id) : undefined}
      onLayout={(e: LayoutChangeEvent) => onPillLayout(season.Id, e.nativeEvent.layout)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [st.pill, active && st.pillActive, pressed && st.pressed]}
    >
      {active && <LinearGradient {...seasonTabGradient(colors.brand)} style={StyleSheet.absoluteFill} />}
      {marked && <View style={[st.dot, { backgroundColor: dot }]} />}
      {watched && (
        <Svg width={15} height={15} viewBox={CARD_GLYPH_VIEWBOX}>
          <Path d={WATCHED_FILLED_PATH} fill={soft} fillRule="evenodd" />
        </Svg>
      )}
      <Text style={[st.label, { color: fg }, active && st.labelActive]}>{season.Name}</Text>
      {count ? (
        <View style={[st.count, active && st.countActive]}>
          <Text style={[st.countText, { color: soft }]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    list: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: RADIUS.pill,
      overflow: "hidden",
      // Verre à 72 % : le libellé garde ≥ 8,6:1 sur n'importe quelle image.
      backgroundColor: t.colors.glass.tintStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border.strong,
    },
    pillActive: { borderColor: "transparent" },
    pressed: { transform: [{ scale: 0.97 }] },
    label: { fontSize: 14, fontFamily: FONT_FAMILY.medium, letterSpacing: 0.1 },
    labelActive: { fontFamily: FONT_FAMILY.semibold },
    dot: { width: 7, height: 7, borderRadius: 3.5 },
    count: { minWidth: 24, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: t.colors.fill.soft, alignItems: "center" },
    countActive: { backgroundColor: "rgba(255, 255, 255, 0.2)" },
    countText: { fontSize: 12, fontFamily: FONT_FAMILY.semibold, fontVariant: ["tabular-nums"] },
  });
