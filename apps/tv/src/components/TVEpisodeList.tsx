import { useState, useRef, useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { useSeasons, useEpisodes, useSeriesWatchState, useJellyfinClient } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { Focusable } from "./focus/Focusable";
import { TVEpisodeRow } from "./TVEpisodeRow";
import { useTVScrollToFocused } from "../hooks/useTVScrollToFocused";
import { Colors, Spacing, Fonts, Radius } from "../theme/colors";

interface TVEpisodeListProps {
  seriesId: string;
  onPlay: (episode: MediaItem) => void;
  /** Force l'épisode surligné (fiche épisode / lecteur) — sinon l'épisode du watch state */
  currentEpisodeId?: string;
  /** Saison présélectionnée (fiche épisode / lecteur) — sinon celle de l'épisode courant */
  initialSeasonId?: string;
  /** Texte du badge de l'épisode surligné (ex. « En cours de visionnage » dans le lecteur) */
  currentBadgeLabel?: string;
  /** Focus D-pad initial sur la row de l'épisode surligné (panneau du lecteur) */
  autoFocusCurrent?: boolean;
  /** Liste en flex:1 (panneau plein écran) au lieu du maxHeight 500 (fiche média) */
  fillHeight?: boolean;
  /** Largeur de vignette relayée aux lignes (160 dans le panneau du lecteur). */
  thumbWidth?: number;
}

const EPISODE_ROW_HEIGHT = 170; // paddingVertical 14*2 + thumbnail 112 + méta/chips ~22 + gap 8

export function TVEpisodeList({
  seriesId, onPlay, currentEpisodeId, initialSeasonId, currentBadgeLabel, autoFocusCurrent, fillHeight, thumbWidth,
}: TVEpisodeListProps) {
  const client = useJellyfinClient();
  const { t } = useTranslation("common");
  const { data: seasons } = useSeasons(seriesId);
  // Épisode « courant » (à reprendre / prochain) — surligné comme sur le web,
  // et sa saison est présélectionnée. `currentEpisodeId` (fiche épisode) prime.
  const { data: watchState } = useSeriesWatchState(seriesId);
  const currentEp = watchState && watchState.type !== "completed" ? watchState.episode : undefined;
  const [selectedSeason, setSelectedSeason] = useState<string | undefined>(undefined);
  const activeSeasonId = selectedSeason ?? initialSeasonId ?? currentEp?.SeasonId ?? seasons?.[0]?.Id;
  const { data: episodes } = useEpisodes(seriesId, activeSeasonId);
  const episodeScrollRef = useRef<ScrollView>(null);
  const seasonScrollRef = useRef<ScrollView>(null);
  // Scroll initial unique vers la pill de saison active (ex. Saison 4 hors écran)
  const seasonScrolled = useRef(false);
  const { makeOnFocus } = useTVScrollToFocused(episodeScrollRef, 60);

  const highlightId = currentEpisodeId ?? currentEp?.Id;

  // Badge violet : override (lecteur : « En cours de visionnage ») sinon
  // Reprendre (en cours) / À suivre (watch state) / Épisode actuel (fiche épisode)
  const badgeFor = useCallback((ep: MediaItem): string | null => {
    if (ep.Id !== highlightId) return null;
    if (currentBadgeLabel) return currentBadgeLabel;
    if ((ep.UserData?.PlaybackPositionTicks ?? 0) > 0) return t("resume", { defaultValue: "Reprendre" });
    if (ep.Id === currentEp?.Id) return t("nextEpisode", { defaultValue: "À suivre" });
    return t("currentEpisode", { defaultValue: "Épisode actuel" });
  }, [highlightId, currentBadgeLabel, currentEp?.Id, t]);

  return (
    <View style={fillHeight ? { flex: 1 } : undefined}>
      {/* Season pills — flexGrow:0 : dans le panneau plein écran (fillHeight),
          un ScrollView horizontal s'étire sinon dans la colonne flex et pousse
          la liste d'épisodes tout en bas */}
      <ScrollView
        ref={seasonScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: Spacing.screenPadding, gap: 10 }}
      >
        {(seasons ?? []).map((season) => {
          const active = season.Id === activeSeasonId;
          return (
            // Wrapper enfant direct du ScrollView : son layout.x est relatif au
            // contenu → scroll initial fiable vers la saison active.
            <View
              key={season.Id}
              onLayout={active && !seasonScrolled.current ? (e) => {
                seasonScrolled.current = true;
                seasonScrollRef.current?.scrollTo({
                  x: Math.max(0, e.nativeEvent.layout.x - Spacing.screenPadding),
                  animated: false,
                });
              } : undefined}
            >
              <Focusable variant="button" focusRadius={Radius.pill} onPress={() => setSelectedSeason(season.Id)}>
                <View style={{
                  paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.pill,
                  backgroundColor: active ? "rgba(139, 92, 246, 0.18)" : Colors.ctaGhostBg,
                  borderWidth: 1,
                  borderColor: active ? "rgba(139, 92, 246, 0.45)" : Colors.glassBorder,
                }}>
                  <Text style={{
                    color: active ? Colors.accentPurpleLight : Colors.textSecondary,
                    fontSize: 15,
                    fontFamily: active ? Fonts.bold : Fonts.medium,
                  }}>
                    {season.Name}
                  </Text>
                </View>
              </Focusable>
            </View>
          );
        })}
      </ScrollView>

      {/* Episodes */}
      <ScrollView
        ref={episodeScrollRef}
        style={fillHeight ? { marginTop: 24, flex: 1 } : { marginTop: 24, maxHeight: 500 }}
        contentContainerStyle={{ paddingHorizontal: Spacing.screenPadding, gap: 8, ...(fillHeight ? { paddingBottom: 40 } : {}) }}
      >
        {(episodes ?? []).map((ep, epIndex) => (
          <TVEpisodeRow
            thumbWidth={thumbWidth}
            key={ep.Id}
            episode={ep}
            thumbUrl={client.getImageUrl(ep.Id, "Primary", { width: 400, quality: 80 })}
            isCurrent={ep.Id === highlightId}
            badgeLabel={badgeFor(ep)}
            autoFocus={autoFocusCurrent && ep.Id === highlightId}
            onPress={() => onPlay(ep)}
            onFocus={makeOnFocus(epIndex, EPISODE_ROW_HEIGHT)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
