/**
 * Octave (mobile) — la marque d'une rangée de titre : gardé sur cet appareil
 * (le glyphe des cartes, vert), en transfert (un anneau qui se remplit : on
 * VOIT où il en est), en préparation (un point qui pulse), en file (une
 * horloge), en défaut (un triangle). Rien quand le titre n'est pas gardé, rien hors de la portée
 * (une session de profil, un serveur sans `offline.music`). Toujours un
 * libellé pour les lecteurs d'écran : la couleur ne dit jamais seule l'état.
 *
 * Placement (m3, m4) : `<KeptMark trackKey={track.key} />` à côté du titre ou
 * de la durée — 14 pt, sans changer la hauteur de la rangée.
 */

import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { trackFraction, trackStage } from "@tentacle-tv/offline-core/music";
import { KeptGlyph } from "@/components/cards/cardGlyphs";
import { useTheme } from "@/theme";
import { PulseDot } from "@/offline/entry/PulseDot";
import { useOfflineSurface } from "./musicOfflineContext";
import { ProgressRing } from "./ProgressRing";
import { useKeptTrack } from "./useKeptMusic";

export const KeptMark = memo(function KeptMark({ trackKey, size = 14 }: { trackKey: string; size?: number }) {
  const surface = useOfflineSurface();
  if (!surface.visible) return null;
  return <KeptMarkFor trackKey={trackKey} size={size} />;
});

function KeptMarkFor({ trackKey, size }: { trackKey: string; size: number }) {
  const { t } = useTranslation("musicOffline");
  const { colors } = useTheme();
  const kept = useKeptTrack(trackKey);
  const stage = trackStage(kept);
  if (stage === "none" || !kept) return null;
  const percent = Math.floor(trackFraction(kept) * 100);
  const label =
    stage === "complete" ? t("kept")
    : stage === "failed" ? t("failed")
    : stage === "transferring" ? t("transferring", { percent })
    : stage === "preparing" ? t("preparing")
    : t("waiting");
  return (
    <View accessible accessibilityLabel={label} style={[styles.mark, { width: size + 4, height: size + 4 }]}>
      {stage === "complete" && <KeptGlyph size={size} color={colors.statusPairs.success.fg} />}
      {stage === "transferring" && <ProgressRing fraction={percent / 100} size={size + 2} stroke={2.5} color={colors.brand.accent} track={colors.border.strong} />}
      {stage === "preparing" && <PulseDot color={colors.brand.accent} corner={false} />}
      {stage === "waiting" && <Feather name="clock" size={size - 2} color={colors.text.tertiary} />}
      {stage === "failed" && <Feather name="alert-triangle" size={size - 2} color={colors.statusPairs.error.fg} />}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: "center", justifyContent: "center" },
});
