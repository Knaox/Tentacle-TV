/**
 * Octave (mobile) — la TRANSITION DOUCE dans le lecteur : pas un interrupteur, une pastille qui dit l'état
 * (« Fondu 5 s », « Fondu coupé ») et ouvre un panneau où l'on VOIT le fondu (`CrossfadeGraph`) et où l'on en
 * choisit la durée sur une réglette à crans — coupée tout à gauche, puis 2 → 12 s. Le même réglage que la page
 * Réglages d'Octave (`crossfadeSetting.ts`, magasin partagé), appliqué au fondu suivant, même pendant l'écoute.
 */

import { memo, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { Blend } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { CROSSFADE_DEFAULT_MS } from "@tentacle-tv/shared/octave";
import { setCrossfadeMs, useCrossfadeMs } from "../audio/crossfadeSetting";
import { CrossfadeGraph } from "./CrossfadeGraph";
import { CrossfadeSlider } from "./CrossfadeSlider";
import { useOctaveColors } from "../theme/octaveColors";

/** La pastille : l'état d'un coup d'œil ; un appui ouvre le panneau. */
export const CrossfadeChip = memo(function CrossfadeChip({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useTranslation("octaveShell");
  const colors = useOctaveColors();
  const ms = useCrossfadeMs();
  const on = ms > 0;
  const pulse = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pulse.value = withSequence(withSpring(1.08, { damping: 8, stiffness: 400 }), withSpring(1, { damping: 12 }));
  }, [ms, pulse]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const label = on ? t("crossfade.chipOn", { count: ms / 1000 }) : t("crossfade.chipOff");
  return (
    <Animated.View style={pop}>
      <Pressable
        onPress={onToggle}
        hitSlop={6}
        style={({ pressed }) => [
          styles.chip,
          { borderColor: on ? colors.accent : colors.line, backgroundColor: on ? colors.accentSoft : "transparent" },
          pressed && { opacity: 0.7 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("crossfade.label")}
        accessibilityValue={{ text: label }}
        accessibilityState={{ expanded: open }}
      >
        <Blend size={16} color={on ? colors.accentText : colors.textSecondary} strokeWidth={2} />
        <Text style={[styles.chipText, { color: on ? colors.accentText : colors.textSecondary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
});

/** Le panneau : le dessin du fondu, la réglette, et le geste « couper / activer » en un appui. */
export const CrossfadePanel = memo(function CrossfadePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("octaveShell");
  const colors = useOctaveColors();
  const ms = useCrossfadeMs();
  const on = ms > 0;
  const lastOn = useRef(on ? ms : CROSSFADE_DEFAULT_MS);
  if (on) lastOn.current = ms;
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutDown.duration(160)}
      style={[styles.panel, { backgroundColor: colors.raised, borderColor: colors.line }]}
      accessibilityViewIsModal={false}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>{t("crossfade.label")}</Text>
          <Text style={[styles.value, { color: on ? colors.accentText : colors.textTertiary }]}>
            {on ? t("crossfade.seconds", { count: ms / 1000 }) : t("crossfade.off")}
          </Text>
        </View>
        <Pressable
          onPress={() => setCrossfadeMs(on ? 0 : lastOn.current)}
          style={({ pressed }) => [styles.action, { borderColor: colors.line }, pressed && { backgroundColor: colors.pressed }]}
          accessibilityRole="button"
        >
          <Text style={[styles.actionText, { color: colors.text }]}>{on ? t("crossfade.turnOff") : t("crossfade.turnOn")}</Text>
        </Pressable>
      </View>
      <View onLayout={onLayout} style={styles.graph}>
        {width > 0 && <CrossfadeGraph ms={ms} width={width} height={56} />}
        <View style={styles.legend} accessible={false}>
          <Text style={[styles.legendText, { color: colors.textTertiary }]}>{t("crossfade.outgoing")}</Text>
          <Text style={[styles.legendText, { color: colors.textTertiary }]}>{t("crossfade.incoming")}</Text>
        </View>
      </View>
      <CrossfadeSlider ms={ms} onChange={setCrossfadeMs} />
      <Text style={[styles.hint, { color: colors.textTertiary }]}>{on ? t("crossfade.controlHint") : t("crossfade.controlOff")}</Text>
      <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" hitSlop={8}>
        <Text style={[styles.closeText, { color: colors.textSecondary }]}>{t("crossfade.close")}</Text>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth * 2 },
  chipText: { fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  panel: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: "700" },
  value: { fontSize: 13, fontWeight: "600", marginTop: 2, fontVariant: ["tabular-nums"] },
  action: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth * 2, justifyContent: "center" },
  actionText: { fontSize: 13, fontWeight: "600" },
  graph: { height: 74 },
  legend: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  legendText: { fontSize: 11 },
  hint: { fontSize: 12, lineHeight: 17 },
  close: { alignSelf: "flex-end", minHeight: 32, justifyContent: "center" },
  closeText: { fontSize: 13, fontWeight: "600" },
});
