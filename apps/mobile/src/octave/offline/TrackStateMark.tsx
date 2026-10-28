/**
 * Octave (mobile) — LA marque d'état d'un titre, la même sur toute rangée (liste,
 * album, recherche, « Sur cet appareil »), d'après la règle unique `trackState`
 * (offline-core) : gardé sur cet appareil (le glyphe des cartes, vert), en route
 * (anneau qui se remplit, point qui pulse, horloge), en défaut (triangle), dans
 * la bibliothèque (le glyphe de l'onglet Bibliothèque), en cloud (un nuage),
 * indisponible (nuage barré, posé par l'axe « indisponible » via `unavailable`).
 * Chaque état a sa FORME — la couleur ne dit jamais seule l'état — et son
 * libellé pour les lecteurs d'écran. 11 à 14 pt, sans changer la hauteur de la rangée.
 *
 * Hors de la portée du hors ligne (session de profil, serveur sans
 * `offline.music`) : rien du disque ne se dit, l'origine (bibliothèque, cloud) reste.
 */

import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { Cloud, CloudOff, Library } from "lucide-react-native";
import { trackFraction, trackStage, trackState, type TrackState } from "@tentacle-tv/offline-core/music";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { KeptGlyph } from "@/components/cards/cardGlyphs";
import { useTheme } from "@/theme";
import { PulseDot } from "@/offline/entry/PulseDot";
import { useOfflineSurface } from "./musicOfflineContext";
import { ProgressRing } from "./ProgressRing";
import { useKeptTrack } from "./useKeptMusic";

interface Props {
  track: Pick<MusicTrack, "key" | "availability" | "jellyfinId">;
  size?: number;
  /** Le titre n'est lisible nulle part (axe « indisponible »). */
  unavailable?: boolean;
}

export const TrackStateMark = memo(function TrackStateMark({ track, size = 14, unavailable = false }: Props) {
  const { t } = useTranslation("musicOffline");
  const { colors } = useTheme();
  const surface = useOfflineSurface();
  const kept = useKeptTrack(track.key);
  const stage = surface.visible ? trackStage(kept) : "none";
  const state: TrackState = trackState({ availability: track.availability, jellyfinId: track.jellyfinId, keptStage: stage, unavailable });
  const percent = kept && stage === "transferring" ? Math.floor(trackFraction(kept) * 100) : 0;
  const label =
    state === "kept" ? t("kept")
    : state === "keepFailed" ? t("failed")
    : state === "keeping" ? (stage === "transferring" ? t("transferring", { percent }) : stage === "preparing" ? t("preparing") : t("waiting"))
    : t(`state.${state}`);
  const muted = colors.text.tertiary;
  return (
    <View accessible accessibilityLabel={label} style={[styles.mark, { width: size + 4, height: size + 4 }]}>
      {state === "kept" && <KeptGlyph size={size} color={colors.statusPairs.success.fg} />}
      {stage === "transferring" && <ProgressRing fraction={percent / 100} size={size + 2} stroke={2.5} color={colors.brand.accent} track={colors.border.strong} />}
      {stage === "preparing" && <PulseDot color={colors.brand.accent} corner={false} />}
      {stage === "waiting" && <Feather name="clock" size={size - 2} color={muted} />}
      {state === "keepFailed" && <Feather name="alert-triangle" size={size - 2} color={colors.statusPairs.error.fg} />}
      {state === "library" && <Library size={size} color={muted} strokeWidth={2} />}
      {state === "cloud" && <Cloud size={size} color={muted} strokeWidth={2} />}
      {state === "unavailable" && <CloudOff size={size} color={colors.statusPairs.error.fg} strokeWidth={2} />}
    </View>
  );
});

const styles = StyleSheet.create({
  mark: { alignItems: "center", justifyContent: "center" },
});
