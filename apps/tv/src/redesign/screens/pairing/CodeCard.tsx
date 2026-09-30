import { memo, useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { BrandMark } from "../../brand/BrandMark";
import { PillButton } from "../../controls/PillButton";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts, white } from "../../theme/tokens";
import type { CodeState } from "./pairingTypes";

/**
 * La carte du code, à droite de l'écran de jumelage : le code en TRÈS grand
 * (une case par caractère), le temps qui reste et sa jauge — ou, selon
 * l'état, le chargement, l'échec (Réessayer, et le recours) ou l'expiration
 * (Générer un nouveau code).
 *
 * La jauge suit `remainingSeconds` : chaque nouvelle valeur (une par
 * seconde) glisse en une seconde, linéaire, sur `transform` seulement.
 */

export const CARD_WIDTH = 820;
export const CARD_HEIGHT = 580;
export const CARD_RADIUS = 44;
const RADIUS = CARD_RADIUS;

export const CodeCard = memo(function CodeCard({ code, fallback, onRetry }: {
  code: CodeState;
  /** Le recours d'un échec : « Configurer manuellement » (relais). */
  fallback?: { label: string; onPress?: () => void };
  onRetry?: () => void;
}) {
  const { t } = useTranslation(["pairing", "common"]);
  return (
    <View style={styles.card}>
      {/* Un fond dense sous le verre : la lumière qui déborde de la carte ne
          doit pas teinter le code. */}
      <View style={[StyleSheet.absoluteFill, styles.base]} />
      <GlassSurface radius={RADIUS} tone="regular" style={StyleSheet.absoluteFill} elevated />
      {code.status === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.text} style={styles.spinner} />
          <Text style={styles.message}>{t("pairing:tvPreparingCode")}</Text>
        </View>
      ) : null}
      {code.status === "error" ? (
        <View style={styles.center}>
          <BrandMark size={120} crying />
          <Text style={[styles.message, styles.messageWide]}>{t("pairing:relayError")}</Text>
          <View style={styles.actions}>
            <PillButton variant="primary" icon="refresh" label={t("common:retry")} focusKey="pairing:retry" onPress={onRetry} />
            {fallback ? <PillButton icon="server" label={fallback.label} focusKey="pairing:manual" onPress={fallback.onPress} /> : null}
          </View>
        </View>
      ) : null}
      {code.status === "active" ? (
        <View style={styles.center}>
          <Text style={styles.label}>{t("pairing:tvYourCode")}</Text>
          <CodeBoxes code={code.code} />
          <Countdown remaining={code.remainingSeconds} total={code.totalSeconds} width={boxesWidth(code.code.length)} />
        </View>
      ) : null}
      {code.status === "expired" ? (
        <View style={styles.center}>
          <CodeBoxes code={code.code ?? "····"} dimmed />
          <View style={styles.expiredRow}>
            <Icon name="clock" size={30} color={colors.errorFg} strokeWidth={2.4} />
            <Text style={styles.expired}>{t("pairing:codeExpired")}</Text>
          </View>
          <PillButton variant="primary" icon="refresh" label={t("pairing:generateNewCode")} focusKey="pairing:regenerate" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
});

function CodeBoxes({ code, dimmed = false }: { code: string; dimmed?: boolean }) {
  return (
    <View style={[styles.boxes, dimmed && styles.dimmed]} accessibilityLabel={code.split("").join(" ")}>
      {code.split("").map((char, index) => (
        <View key={`${index}-${char}`} style={styles.box}>
          <Text style={styles.char}>{char}</Text>
        </View>
      ))}
    </View>
  );
}

function Countdown({ remaining, total, width }: { remaining: number; total: number; width: number }) {
  const { t } = useTranslation("pairing");
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const progress = useSharedValue(ratio);
  useEffect(() => {
    progress.value = withTiming(ratio, { duration: 1000, easing: Easing.linear });
  }, [ratio, progress]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  const minutes = Math.floor(remaining / 60);
  const seconds = String(Math.max(0, remaining % 60)).padStart(2, "0");
  return (
    <View style={[styles.countdown, { width }]}>
      <View style={styles.timerRow}>
        <Icon name="clock" size={28} color={colors.textSecondary} strokeWidth={2.2} />
        <Text style={styles.timer}>{t("expiresIn", { time: `${minutes}:${seconds}` })}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fill]} />
      </View>
    </View>
  );
}

const BOX = { width: 150, height: 188 };
const BOX_GAP = 22;
const boxesWidth = (count: number) => Math.max(1, count) * BOX.width + Math.max(0, count - 1) * BOX_GAP;

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: RADIUS },
  base: { borderRadius: RADIUS, backgroundColor: "rgba(10, 10, 14, 0.9)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 56, gap: 30 },
  spinner: { transform: [{ scale: 1.6 }], marginBottom: 12 },
  label: { ...fonts.bold, fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: colors.textTertiary },
  message: { ...fonts.medium, fontSize: 28, lineHeight: 38, color: colors.textSecondary, textAlign: "center" },
  messageWide: { maxWidth: 640 },
  actions: { flexDirection: "row", gap: 18, marginTop: 6 },
  boxes: { flexDirection: "row", gap: BOX_GAP },
  dimmed: { opacity: 0.28 },
  box: {
    width: BOX.width,
    height: BOX.height,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: white(0.08),
    borderWidth: 1,
    borderColor: white(0.16),
  },
  char: { ...fonts.extrabold, fontSize: 116, lineHeight: 132, color: colors.text, fontVariant: ["tabular-nums"] },
  countdown: { gap: 18, marginTop: 4 },
  timerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  timer: { ...fonts.semibold, fontSize: 28, lineHeight: 36, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  track: { height: 8, borderRadius: 4, backgroundColor: white(0.12), overflow: "hidden" },
  fill: { flex: 1, borderRadius: 4, backgroundColor: colors.accent, transformOrigin: "left" },
  expiredRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  expired: { ...fonts.bold, fontSize: 36, lineHeight: 44, color: colors.errorFg },
});
