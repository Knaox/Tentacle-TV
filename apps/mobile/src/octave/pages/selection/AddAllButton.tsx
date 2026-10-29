/**
 * Octave mobile — « Ajouter tous les titres à une playlist » (à côté de Lecture / Aléatoire d'un album, d'une
 * playlist) : le choix de playlist des titres GROUPÉS — ordre gardé, règle de doublon groupée (tout, sans les
 * doublons, ou rien). Même rond que « garder sur l'appareil ». Rien si aucun titre ne peut y entrer.
 */

import { memo } from "react";
import { StyleSheet } from "react-native";
import { ListPlus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { openPlaylistChooserForMany } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { PressableScale } from "../../layout/PressableScale";
import { useOctaveColors } from "../../theme/octaveColors";
import { useMobileTrackActions } from "../env/useMobileActionsUi";

const SIZE = 44;

export const AddAllButton = memo(function AddAllButton({ tracks }: { tracks: readonly MusicTrack[] }) {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  const actions = useMobileTrackActions();
  const able = tracks.filter(actions.canAddToPlaylist);
  if (able.length === 0) return null;
  return (
    <PressableScale
      pressedScale={0.94}
      accessibilityRole="button"
      accessibilityLabel={t("selection.addAll")}
      hitSlop={6}
      onPress={() => openPlaylistChooserForMany(able)}
      style={[styles.round, { backgroundColor: colors.pressed, borderColor: colors.line }]}
    >
      <ListPlus size={22} color={colors.text} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  round: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
});
