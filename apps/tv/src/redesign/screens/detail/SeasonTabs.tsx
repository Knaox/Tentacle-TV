import { memo, useCallback, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { Chip } from "../../controls/Chip";
import { colors } from "../../theme/tokens";
import { DETAIL_LEFT } from "./DetailSection";
import type { SeasonTabModel } from "./detailTypes";

/**
 * La bande des saisons : une pastille par saison, le nombre d'épisodes en
 * détail. La saison AFFICHÉE est retenue (`selected`), celle de l'épisode à
 * reprendre porte un point, une saison vue une coche. Jusqu'à 15 saisons et
 * plus : la bande défile, et s'ouvre calée sur la saison affichée.
 *
 * Contrat : `useSeasonBrowser` — `seasons`, `selectedSeasonId`,
 * `markedSeasonId`, `select`, `prefetch` (au focus d'un onglet).
 */

/** Les onglets qui précèdent la saison affichée restent en vue, à gauche. */
const LEAD = 260;

export const SeasonTabs = memo(function SeasonTabs({
  seasons,
  selectedId,
  onSelect,
  onFocusSeason,
  onFocusChange,
}: {
  seasons: SeasonTabModel[];
  selectedId?: string;
  onSelect?: (seasonId: string) => void;
  onFocusSeason?: (seasonId: string) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  const placed = useRef(false);
  // Calée une fois, à l'arrivée : la bande ne saute plus ensuite sous le focus.
  const place = useCallback((x: number) => {
    if (placed.current) return;
    placed.current = true;
    if (x - LEAD > DETAIL_LEFT) scroll.current?.scrollTo({ x: x - DETAIL_LEFT - LEAD, animated: false });
  }, []);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.track}
      contentContainerStyle={styles.content}
    >
      {seasons.map((season, index) => {
        const selected = season.id === selectedId;
        return (
          <View key={season.id} onLayout={selected ? (event) => place(event.nativeEvent.layout.x) : undefined}>
            <Chip
              label={season.label}
              detail={season.episodeCount ? String(season.episodeCount) : undefined}
              icon={season.state === "current" ? "dot" : season.state === "watched" ? "check" : undefined}
              selected={selected}
              focusKey={`season:${index}`}
              onPress={onSelect ? () => onSelect(season.id) : undefined}
              onFocusChange={(focused) => {
                onFocusChange?.(focused);
                if (focused) onFocusSeason?.(season.id);
              }}
            />
            {/* La saison affichée se souligne d'ambre : l'onglet actif se lit de loin. */}
            {selected ? <View style={styles.indicator} /> : null}
          </View>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  // Le débord laisse la place à l'agrandissement de l'onglet focalisé.
  track: { overflow: "visible" },
  content: { gap: 14, paddingLeft: DETAIL_LEFT, paddingRight: TV_STAGE.safe.x, paddingTop: 10, paddingBottom: 18 },
  indicator: { position: "absolute", bottom: -12, alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.accent },
});
