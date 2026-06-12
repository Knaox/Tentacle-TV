import { View, Text, TVFocusGuideView } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { TVEpisodeList } from "../TVEpisodeList";
import { useTVRemote } from "../focus/useTVRemote";
import { Colors, Spacing, Typography } from "../../theme/colors";

interface TVPlayerEpisodePanelProps {
  seriesId: string;
  /** Épisode en cours de lecture — cible la saison et surligne la row */
  currentEpisode?: MediaItem | null;
  onSelectEpisode: (episode: MediaItem) => void;
  onClose: () => void;
}

/**
 * Panneau « Saisons & épisodes » DANS le lecteur (séries) — même sélecteur
 * que la fiche série, centré sur l'épisode EN COURS DE LECTURE : saison
 * présélectionnée, badge « En cours de visionnage », focus initial sur la row.
 * BACK referme sans quitter la lecture.
 */
export function TVPlayerEpisodePanel({ seriesId, currentEpisode, onSelectEpisode, onClose }: TVPlayerEpisodePanelProps) {
  const { t } = useTranslation(["common", "player"]);
  // Monté en dernier → son BACK est prioritaire (LIFO) : referme le panneau.
  useTVRemote({ onBack: onClose });

  return (
    <View style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(8, 8, 12, 0.96)",
      zIndex: 70, elevation: 70,
    }}>
      {/* Légère profondeur : le haut est plus sombre, le contenu reste lisible
          sans que la vidéo concurrence le texte (scrim modal opaque) */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.5)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200 }}
      />

      {/* Piège le focus dans le panneau (même garde-fou que TVTrackSelector) :
          sans lui, le D-pad pouvait « tomber » sur l'OSD derrière. */}
      {/* @ts-ignore — props TVFocusGuideView de react-native-tvos */}
      <TVFocusGuideView autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={{ flex: 1, paddingTop: 36 }}>
        {/* Header : contexte série + titre du panneau */}
        <View style={{ paddingHorizontal: Spacing.screenPadding, marginBottom: 18 }}>
          <Text style={{ color: Colors.textPrimary, ...Typography.sectionTitle }}>
            {t("common:seasonsEpisodes", { defaultValue: "Saisons & Épisodes" })}
          </Text>
          {!!currentEpisode?.SeriesName && (
            <Text style={{ color: Colors.textMuted, fontSize: 15, marginTop: 4 }}>
              {currentEpisode.SeriesName}
            </Text>
          )}
          <View style={{ height: 1, backgroundColor: Colors.divider, marginTop: 14 }} />
        </View>

        <TVEpisodeList
          seriesId={seriesId}
          onPlay={onSelectEpisode}
          currentEpisodeId={currentEpisode?.Id}
          initialSeasonId={currentEpisode?.SeasonId}
          currentBadgeLabel={t("player:nowPlaying", { defaultValue: "En cours de visionnage" })}
          autoFocusCurrent
          fillHeight
        />
      </TVFocusGuideView>
    </View>
  );
}
