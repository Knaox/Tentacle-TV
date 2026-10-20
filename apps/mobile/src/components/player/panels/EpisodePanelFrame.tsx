import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton } from "@/components/ui/buttons";
import { TABLET_MIN_WIDTH } from "@/theme";
import { useChromeInsets } from "../../../player/chrome/useChromeInsets";
import { EPISODE_CARD_WIDTH, panelLayout } from "../../../player/panels/panelLayout";
import { PanelSurface } from "./PanelSurface";
import { SeasonTabs, type SeasonTab } from "./SeasonTabs";
import { PANEL, PANEL_TYPE } from "./panelTokens";

export interface EpisodePanelGeometry {
  /** Étagère qui défile de côté (paysage, iPad). */
  horizontal: boolean;
  cardWidth: number;
}

interface Props {
  seasons: readonly SeasonTab[];
  activeSeasonId: string | undefined;
  onSelectSeason: (id: string) => void;
  onSeasonIntent?: (id: string) => void;
  /** Les épisodes ne sont pas encore là. */
  loading: boolean;
  /** Aucun épisode à montrer. */
  empty: boolean;
  onClose: () => void;
  children: (geometry: EpisodePanelGeometry) => ReactNode;
}

/**
 * Le cadre du panneau des épisodes, en ligne comme hors ligne : l'étagère en
 * bas (titre, saisons et « fermer » sur UNE ligne, pour laisser l'image au-
 * dessus), ou la carte du bas d'un téléphone debout (saisons sous le titre).
 */
export function EpisodePanelFrame({ seasons, activeSeasonId, onSelectSeason, onSeasonIntent, loading, empty, onClose, children }: Props) {
  const { t } = useTranslation("player");
  const { width, height } = useWindowDimensions();
  const edges = useChromeInsets();
  const insets = useSafeAreaInsets();
  const isTablet = Math.min(width, height) >= TABLET_MIN_WIDTH;
  const frame = panelLayout({ kind: "episodes", width, height, isTablet, edges, insets });
  const horizontal = frame.mode === "shelf";
  const tabs = (
    <SeasonTabs seasons={seasons} activeId={activeSeasonId} onSelect={onSelectSeason} onIntent={onSeasonIntent} />
  );
  const close = (
    <IconButton icon="x" size={30} variant="plain" color={PANEL.secondary} bgColor={PANEL.closeFill} onPress={onClose} accessibilityLabel={t("close")} />
  );

  return (
    <PanelSurface frame={frame} onClose={onClose} fill={!horizontal}>
      <View style={st.header}>
        <Text accessibilityRole="header" numberOfLines={1} style={st.title}>{t("panels.episodesTitle")}</Text>
        {horizontal ? <View style={st.inlineTabs}>{tabs}</View> : <View style={st.spacer} />}
        {close}
      </View>
      {!horizontal && tabs}
      {loading ? (
        <View style={st.state}><ActivityIndicator color={PANEL.secondary} /></View>
      ) : empty ? (
        <View style={st.state}><Text style={st.empty}>{t("noEpisodes")}</Text></View>
      ) : (
        children({ horizontal, cardWidth: isTablet ? EPISODE_CARD_WIDTH.tablet : EPISODE_CARD_WIDTH.phone })
      )}
    </PanelSurface>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 18, paddingRight: 12, paddingTop: 12, paddingBottom: 10 },
  title: { color: PANEL.label, fontSize: PANEL_TYPE.title, fontWeight: "600" },
  // Les onglets en ligne n'ont pas leur marge basse ni leur retrait : le titre les précède.
  inlineTabs: { flex: 1, marginBottom: -10, marginLeft: 2 },
  spacer: { flex: 1 },
  state: { minHeight: 120, alignItems: "center", justifyContent: "center" },
  empty: { color: PANEL.secondary, fontSize: PANEL_TYPE.body },
});
