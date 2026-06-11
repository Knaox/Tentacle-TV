import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { TVEpisodeList } from "../TVEpisodeList";
import { useTVRemote } from "../focus/useTVRemote";
import { Colors, Spacing, Typography } from "../../theme/colors";

interface TVPlayerEpisodePanelProps {
  seriesId: string;
  onSelectEpisode: (episode: MediaItem) => void;
  onClose: () => void;
}

/**
 * Panneau « Saisons & épisodes » DANS le lecteur (séries) — même sélecteur
 * que la fiche série (TVEpisodeList, épisode courant surligné), ouvert via
 * l'OSD. BACK referme sans quitter la lecture.
 */
export function TVPlayerEpisodePanel({ seriesId, onSelectEpisode, onClose }: TVPlayerEpisodePanelProps) {
  const { t } = useTranslation("common");
  // Monté en dernier → son BACK est prioritaire (LIFO) : referme le panneau.
  useTVRemote({ onBack: onClose });

  return (
    <View style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.88)",
      zIndex: 70, elevation: 70,
      paddingTop: 36,
    }}>
      <Text style={{
        color: Colors.textPrimary, ...Typography.sectionTitle,
        paddingHorizontal: Spacing.screenPadding, marginBottom: 18,
      }}>
        {t("seasonsEpisodes", { defaultValue: "Saisons & Épisodes" })}
      </Text>
      <TVEpisodeList seriesId={seriesId} onPlay={onSelectEpisode} />
    </View>
  );
}
