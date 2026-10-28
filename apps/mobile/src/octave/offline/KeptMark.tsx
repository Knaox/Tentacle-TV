/**
 * Octave (mobile) — la marque d'une rangée de titre : gardé sur cet appareil
 * (le glyphe des cartes, vert), en préparation (un point qui pulse), en défaut
 * (un triangle). Rien quand le titre n'est pas gardé, rien hors de la portée
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
import { trackPhase } from "@tentacle-tv/offline-core/music";
import { KeptGlyph } from "@/components/cards/cardGlyphs";
import { useTheme } from "@/theme";
import { PulseDot } from "@/offline/entry/PulseDot";
import { useOfflineSurface } from "./musicOfflineContext";
import { useKeptTrack } from "./useKeptMusic";

export const KeptMark = memo(function KeptMark({ trackKey, size = 14 }: { trackKey: string; size?: number }) {
  const surface = useOfflineSurface();
  if (!surface.visible) return null;
  return <KeptMarkFor trackKey={trackKey} size={size} />;
});

function KeptMarkFor({ trackKey, size }: { trackKey: string; size: number }) {
  const { t } = useTranslation("musicOffline");
  const { colors } = useTheme();
  const phase = trackPhase(useKeptTrack(trackKey));
  if (phase === "none") return null;
  const label = phase === "complete" ? t("kept") : phase === "failed" ? t("failed") : t("inProgress");
  return (
    <View accessible accessibilityLabel={label} style={[styles.mark, { width: size + 4, height: size + 4 }]}>
      {phase === "complete" && <KeptGlyph size={size} color={colors.statusPairs.success.fg} />}
      {phase === "progress" && <PulseDot color={colors.brand.accent} corner={false} />}
      {phase === "failed" && <Feather name="alert-triangle" size={size - 2} color={colors.statusPairs.error.fg} />}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: "center", justifyContent: "center" },
});
