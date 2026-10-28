/**
 * Octave (mobile) — le MODE HORS LIGNE visible partout dans Octave : une capsule
 * de verre discrète, centrée juste au-dessus du mini-lecteur et de la barre
 * d'onglets, tant que l'application est hors ligne (par choix ou subi). Toucher
 * ouvre « Sur cet appareil », qui dit pourquoi et permet d'en sortir. Absente
 * sur cette page même (sa bascule le dit déjà) et pour une session de profil
 * (le hors ligne est au compte de l'appareil). Apparition en fondu (Reanimated,
 * mouvement réduit respecté) ; jamais un voile, jamais une cible sous le pouce
 * d'un autre geste (44 pt de haut, hors des onglets).
 */

import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";
import { usePathname, useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { OctaveGlass } from "../layout/OctaveGlass";
import { OCTAVE_MINI_GAP, useOctaveChrome } from "../shell/octaveChrome";
import { useOctaveColors } from "../theme/octaveColors";
import { useOfflineSurface } from "./musicOfflineContext";

/** Écart au-dessus de ce qui est en bas (barre, mini-lecteur). */
const GAP = 8;

export const OctaveOfflinePill = memo(function OctaveOfflinePill() {
  const offline = useOfflineMode();
  const surface = useOfflineSurface();
  const pathname = usePathname();
  if (!offline || !surface.visible || pathname.startsWith(octavePaths.device)) return null;
  return <Pill />;
});

function Pill() {
  const { t } = useTranslation("musicOffline");
  const colors = useOctaveColors();
  const chrome = useOctaveChrome();
  const router = useRouter();
  const open = useCallback(() => router.push(octavePaths.device as Href), [router]);
  const base = chrome.layout === "tablet" ? 16 : chrome.tabBarHeight;
  const bottom = base + (chrome.miniPlayerHeight > 0 ? chrome.miniPlayerHeight + OCTAVE_MINI_GAP : 0) + GAP;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom, left: chrome.sidebarWidth }]}>
      <Animated.View entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(140).reduceMotion(ReduceMotion.System)}>
        <OctaveGlass radius={22} interactive>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("mode.pill")}
            accessibilityHint={t("mode.pillHint")}
            onPress={open}
            style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
          >
            <Feather name="wifi-off" size={15} color={colors.accentText} />
            <Text style={[styles.label, { color: colors.text }]}>{t("mode.pill")}</Text>
            <Feather name="chevron-right" size={15} color={colors.textTertiary} />
          </Pressable>
        </OctaveGlass>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 0, alignItems: "center" },
  pill: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 },
  label: { fontSize: 15, fontWeight: "600" },
});
