import { memo, useEffect } from "react";
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { SeekWaitPhase } from "@tentacle-tv/shared";
import { FONT_FAMILY, PLAYER } from "@/theme";

/**
 * L'attente d'un saut pendant un transcodage (`player/transcodeSeek.ts`) :
 * l'indicateur dès l'appui — Jellyfin relance sa conversion au nouveau
 * passage, l'image reste figée —, puis la phrase passé 5 s. Au centre, sans
 * capter le toucher : les contrôles restent utilisables pendant l'attente.
 */
export const SeekWaitIndicator = memo(function SeekWaitIndicator({ phase }: { phase: SeekWaitPhase }) {
  const { t } = useTranslation("player");
  const slow = phase === "slow";
  useEffect(() => {
    if (slow) AccessibilityInfo.announceForAccessibility(t("seekPreparing"));
  }, [slow, t]);
  if (phase !== "loading" && !slow) return null;
  return (
    <View pointerEvents="none" style={st.layer}>
      <ActivityIndicator size="large" color={PLAYER.text} accessibilityLabel={t("loading")} />
      {slow ? <Text style={st.hint}>{t("seekPreparing")}</Text> : null}
    </View>
  );
});

const st = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 24, zIndex: 30 },
  hint: {
    maxWidth: 360, overflow: "hidden", borderRadius: 999, backgroundColor: PLAYER.controlBg,
    paddingHorizontal: 16, paddingVertical: 7, textAlign: "center",
    fontSize: 14, lineHeight: 19, fontFamily: FONT_FAMILY.medium, color: PLAYER.text,
  },
});
