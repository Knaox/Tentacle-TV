import { memo, useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, PLAYER } from "@/theme";
import { haptic } from "@/utils/haptics";

/** Au-delà, une lecture qui recharge n'est plus un à-coup : on le dit. */
const STALL_MS = 8000;

interface Props {
  buffering: boolean;
  started: boolean;
  paused: boolean;
  /** Le flux est converti : c'est le serveur qui ne suit pas, plus le réseau. */
  transcoding: boolean;
  /** Un palier plus bas existe ; `onLowerQuality` y passe. */
  canLowerQuality: boolean;
  onLowerQuality: () => void;
}

/**
 * Le bandeau d'une lecture qui CALE — ce que dit l'Apple TV (« La vidéo se
 * fait attendre ») : rien ne s'arrête, la vidéo recharge, et le bandeau dit
 * pourquoi (le réseau, ou le serveur qui convertit) et offre « Qualité
 * réduite ». Il part dès que la lecture reprend ; fermé, il ne revient pas
 * de cette lecture. Jamais focalisable par défaut, jamais par-dessus Retour.
 */
export const PlayerStallNotice = memo(function PlayerStallNotice({
  buffering, started, paused, transcoding, canLowerQuality, onLowerQuality,
}: Props) {
  const { t } = useTranslation("errors");
  const insets = useSafeAreaInsets();
  const [stalled, setStalled] = useState(false);
  const [closed, setClosed] = useState(false);
  const waiting = buffering && started && !paused;

  useEffect(() => {
    if (!waiting) {
      setStalled(false);
      return undefined;
    }
    const timer = setTimeout(() => setStalled(true), STALL_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  const reason = t(transcoding ? "stallTranscode" : "stallNetwork");
  const shown = stalled && !closed;
  useEffect(() => {
    if (shown) AccessibilityInfo.announceForAccessibility(`${t("stallTitle")}. ${reason}`);
  }, [shown, reason, t]);
  if (!shown) return null;

  // Sous la barre du haut de l'habillage : jamais par-dessus Retour.
  return (
    <View pointerEvents="box-none" style={[st.layer, { top: Math.max(insets.top, 16) + 64 }]}>
      <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(140)} style={st.card}>
        <Feather name="activity" size={18} color={PLAYER.warning} style={st.icon} />
        <View style={st.texts} accessible accessibilityRole="alert" accessibilityLabel={`${t("stallTitle")}. ${reason}`}>
          <Text style={st.title}>{t("stallTitle")}</Text>
          <Text style={st.reason}>{reason}</Text>
        </View>
        {canLowerQuality ? (
          <Pressable
            onPress={() => {
              haptic("tap");
              setClosed(true);
              onLowerQuality();
            }}
            accessibilityRole="button"
            accessibilityLabel={t("actionLowerQuality")}
            style={({ pressed }) => [st.action, pressed && st.pressed]}
          >
            <Text style={st.actionTxt}>{t("actionLowerQuality")}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => setClosed(true)}
          accessibilityRole="button"
          accessibilityLabel={t("notices:close")}
          hitSlop={4}
          style={({ pressed }) => [st.close, pressed && st.pressed]}
        >
          <Feather name="x" size={16} color={PLAYER.textSecondary} />
        </Pressable>
      </Animated.View>
    </View>
  );
});

const st = StyleSheet.create({
  layer: { position: "absolute", left: 12, right: 12, alignItems: "center", zIndex: 45, elevation: 45 },
  // Opaque : rien ne se compose sur la vidéo (règle du lecteur).
  card: {
    flexDirection: "row", alignItems: "center", gap: 10, maxWidth: 560, minHeight: 56,
    paddingLeft: 14, borderRadius: 18, backgroundColor: "rgba(10, 10, 14, 0.94)",
    borderWidth: 1, borderColor: PLAYER.border,
  },
  icon: { marginRight: 2 },
  texts: { flexShrink: 1, paddingVertical: 10, gap: 1 },
  title: { color: PLAYER.text, fontSize: 14, fontFamily: FONT_FAMILY.semibold },
  reason: { color: PLAYER.textSecondary, fontSize: 13, lineHeight: 17, fontFamily: FONT_FAMILY.regular },
  action: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 9999, backgroundColor: PLAYER.text },
  actionTxt: { color: PLAYER.textInverse, fontSize: 13, fontFamily: FONT_FAMILY.semibold },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
});
