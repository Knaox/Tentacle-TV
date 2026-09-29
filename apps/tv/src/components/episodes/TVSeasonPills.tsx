import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TVFocusGuideView, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { CARD_GLYPH_VIEWBOX, WATCHED_FILLED_PATH, type MediaItem } from "@tentacle-tv/shared";
import { mixHex } from "@tentacle-tv/theme";
import { Focusable } from "../focus/Focusable";
import { BRAND, Colors, Spacing, Fonts, Radius } from "../../theme/colors";

/** Hauteur d'une pastille (12 + texte 15 + 12, bordure comprise). */
const PILL_HEIGHT = 44;
/** Réserve verticale autour de la bande : l'anneau et l'agrandissement de la
 *  pastille focalisée y passent sans être rognés par le défilement. */
const BAND_BLEED = 8;
/** Focus maintenu sur une saison avant de la précharger : balayer la bande ne charge rien. */
const INTENT_MS = 200;
/** Le verre des pastilles : le libellé blanc y garde ≥ 10:1, quelle que soit l'image derrière. */
const PILL_SURFACE = "rgba(10, 10, 18, 0.8)";
const PILL_BORDER = "rgba(255, 255, 255, 0.14)";

/**
 * La bande des saisons, extraite de la liste d'épisodes — la grammaire du
 * bureau et du téléphone : verre épais sous un libellé plein, saison affichée
 * en dégradé de marque profond (4,6:1 sous le blanc), point pour la saison en
 * cours, coche des cartes pour une saison vue, compteur d'épisodes.
 *
 * **Sa hauteur est réservée avant que les saisons arrivent.** Elle naissait à
 * zéro puis prenait une cinquantaine de points à la réponse du serveur : toute
 * la liste descendait d'un coup, épisode focalisé compris.
 *
 * **On y entre par la saison AFFICHÉE**, pas par la pastille que l'abscisse du
 * point de départ désignait — la saison 4 quand on remontait de l'épisode 1 de
 * la saison 11. C'est la zone `saisons` de la LG (entrée sur `aria-selected`) :
 * un guide de focus dont la destination est l'onglet actif.
 *
 * **Le focus qui s'attarde précharge** la saison (liste légère) : quand on la
 * choisit, ses épisodes sont déjà là.
 */
export const TVSeasonPills = memo(function TVSeasonPills({
  seasons,
  activeSeasonId,
  markedSeasonId,
  onSelect,
  onIntent,
}: {
  seasons: MediaItem[] | undefined;
  activeSeasonId: string | undefined;
  markedSeasonId?: string;
  onSelect: (seasonId: string) => void;
  onIntent?: (seasonId: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  // Le calage initial sur la saison active — une seule fois, à l'arrivée.
  const wedged = useRef(false);
  const [activeNode, setActiveNode] = useState<View | null>(null);
  const destinations = useMemo(() => (activeNode ? [activeNode] : []), [activeNode]);
  const intent = useDwell(onIntent);

  const wedge = useCallback((x: number) => {
    if (wedged.current) return;
    wedged.current = true;
    scrollRef.current?.scrollTo({ x: Math.max(0, x - Spacing.screenPadding), animated: false });
  }, []);

  return (
    <TVFocusGuideView
      destinations={destinations}
      style={{ height: PILL_HEIGHT + BAND_BLEED * 2 }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: Spacing.screenPadding,
          paddingVertical: BAND_BLEED,
          gap: 10,
        }}
      >
        {(seasons ?? []).map((season) => {
          const active = season.Id === activeSeasonId;
          return (
            // Enfant direct du ScrollView : son layout.x est relatif au contenu.
            <View
              key={season.Id}
              onLayout={active ? (e) => wedge(e.nativeEvent.layout.x) : undefined}
            >
              <SeasonPill
                season={season}
                active={active}
                marked={season.Id === markedSeasonId}
                nodeRef={active ? setActiveNode : undefined}
                onSelect={onSelect}
                intent={intent}
              />
            </View>
          );
        })}
      </ScrollView>
    </TVFocusGuideView>
  );
});

interface PillProps {
  season: MediaItem;
  active: boolean;
  marked: boolean;
  nodeRef?: (node: View | null) => void;
  onSelect: (seasonId: string) => void;
  intent: { start: (seasonId: string) => void; cancel: () => void };
}

const SeasonPill = memo(function SeasonPill({ season, active, marked, nodeRef, onSelect, intent }: PillProps) {
  const { t } = useTranslation("common");
  const count = season.RecursiveItemCount ?? season.ChildCount;
  const watched = !marked && season.UserData?.Played === true && count !== 0;
  const status = marked ? t("seasonTabCurrent") : watched ? t("seasonTabWatched") : null;
  const label = [season.Name, count ? t("seasonTabEpisodes", { count }) : null, status].filter(Boolean).join(", ");
  const soft = active ? "#FFFFFF" : Colors.textSecondary;

  return (
    <Focusable
      ref={nodeRef}
      variant="button"
      focusRadius={Radius.pill}
      onPress={() => onSelect(season.Id)}
      onFocus={active ? undefined : () => intent.start(season.Id)}
      onBlur={intent.cancel}
      accessibilityLabel={label}
    >
      <View style={[styles.pill, active && styles.pillActive]}>
        {active && (
          // Lu au rendu : un thème d'administrateur change la marque au démarrage.
          <LinearGradient
            colors={[BRAND.dark, mixHex(BRAND.dark, BRAND.accentLight, 0.5, "#9333EA"), BRAND.accentDark]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {marked && <View style={[styles.dot, { backgroundColor: active ? "#FFFFFF" : BRAND.accentLight }]} />}
        {watched && (
          <Svg width={16} height={16} viewBox={CARD_GLYPH_VIEWBOX}>
            <Path d={WATCHED_FILLED_PATH} fill={soft} fillRule="evenodd" />
          </Svg>
        )}
        <Text style={[styles.label, active && styles.labelActive]}>{season.Name}</Text>
        {count ? (
          <View style={[styles.count, active && styles.countActive]}>
            <Text style={[styles.countText, { color: soft }]}>{count}</Text>
          </View>
        ) : null}
      </View>
    </Focusable>
  );
});

/** Un focus qui reste `INTENT_MS` sur une saison vaut intention : la précharger. */
function useDwell(onIntent: ((seasonId: string) => void) | undefined) {
  const latest = useRef(onIntent);
  useEffect(() => {
    latest.current = onIntent;
  }, [onIntent]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = useCallback(() => clearTimeout(timer.current), []);
  const start = useCallback((seasonId: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current?.(seasonId), INTENT_MS);
  }, []);
  useEffect(() => cancel, [cancel]);
  return useMemo(() => ({ start, cancel }), [start, cancel]);
}

const styles = StyleSheet.create({
  pill: {
    height: PILL_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 22,
    borderRadius: Radius.pill,
    overflow: "hidden",
    backgroundColor: PILL_SURFACE,
    borderWidth: 1,
    borderColor: PILL_BORDER,
  },
  pillActive: { borderColor: "transparent" },
  label: { color: "#FFFFFF", fontSize: 15, fontFamily: Fonts.medium },
  labelActive: { fontFamily: Fonts.bold },
  dot: { width: 8, height: 8, borderRadius: 4 },
  count: { minWidth: 26, paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.pill, backgroundColor: "rgba(255, 255, 255, 0.1)", alignItems: "center" },
  countActive: { backgroundColor: "rgba(255, 255, 255, 0.2)" },
  countText: { fontSize: 13, fontFamily: Fonts.bold, fontVariant: ["tabular-nums"] },
});
