import { useEffect, useRef, useState } from "react";
import { View, Text, PanResponder, StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { IconButton } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, ctlGradient, motion, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

let Haptics: { selectionAsync?: () => void } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* optionnel */ }

const THUMB = 24;
const TRACK_H = 6;

interface Props {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** À chaque cran (état local du parent). */
  onChange: (value: number) => void;
  /** Au relâcher ou après ± : le moment de sauvegarder. */
  onChangeEnd?: (value: number) => void;
  accessibilityLabel: string;
  /** « 40 sur 100 » — lu par les lecteurs d'écran et affiché sous la piste. */
  valueText: string;
  leftLabel: string;
  rightLabel: string;
}

/**
 * Un curseur à crans sans dépendance native : une piste de 44 pt (tap et
 * glissé, un PanResponder), des boutons − / + et le rôle « ajustable » pour
 * les lecteurs d'écran (geste haut/bas = un cran). Le curseur ne bouge qu'en
 * `transform`, jamais en layout ; sec en mouvement réduit.
 */
export function SteppedSlider({
  value, min = 0, max = 100, step = 10, onChange, onChangeEnd,
  accessibilityLabel, valueText, leftLabel, rightLabel,
}: Props) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const gradient = ctlGradient(theme.colors.brand);
  const [trackW, setTrackW] = useState(0);
  const steps = Math.max(1, Math.round((max - min) / step));
  const snap = (v: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
  const ratio = max > min ? (value - min) / (max - min) : 0;

  const x = useSharedValue(ratio * trackW);
  useEffect(() => {
    x.value = withTiming(ratio * trackW, { duration: motion.respectReducedMotion(120) });
  }, [ratio, trackW, x]);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - THUMB / 2 }] }));

  // Le PanResponder est créé une fois : il lit des refs, toujours fraîches.
  const ref = useRef({ trackW, trackX: NaN, value, onChange, onChangeEnd, min, max, step });
  Object.assign(ref.current, { trackW, value, onChange, onChangeEnd, min, max, step });
  const trackRef = useRef<View>(null);
  // La position du geste se lit en coordonnées de FENÊTRE (`pageX`) contre
  // l'abscisse mesurée de la piste : `locationX` est relative à la vue
  // touchée, et sous Fabric ce n'est pas toujours la piste (un cran, le
  // remplissage) — mesuré sur Android : un appui à 80 % rendait 0.
  const gestureX = (e: { nativeEvent: { pageX: number; locationX: number } }) => {
    const { trackX } = ref.current;
    return Number.isFinite(trackX) ? e.nativeEvent.pageX - trackX : e.nativeEvent.locationX;
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2,
      onPanResponderGrant: (e) => commit(gestureX(e)),
      onPanResponderMove: (e) => commit(gestureX(e)),
      onPanResponderRelease: () => ref.current.onChangeEnd?.(ref.current.value),
      onPanResponderTerminate: () => ref.current.onChangeEnd?.(ref.current.value),
    }),
  ).current;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackW(e.nativeEvent.layout.width);
    trackRef.current?.measureInWindow((x) => { ref.current.trackX = x; });
  };

  function commit(px: number) {
    const r = ref.current;
    const w = Math.max(1, r.trackW);
    const raw = r.min + (Math.min(w, Math.max(0, px)) / w) * (r.max - r.min);
    const next = Math.min(r.max, Math.max(r.min, Math.round((raw - r.min) / r.step) * r.step + r.min));
    if (next === r.value) return;
    // Mémorisé ici même : pour un simple appui, le relâcher arrive avant le
    // rendu qui porterait la nouvelle valeur — il sauvegarderait l'ancienne.
    r.value = next;
    Haptics?.selectionAsync?.();
    r.onChange(next);
  }

  const nudge = (dir: 1 | -1) => {
    const next = snap(value + dir * step);
    if (next === value) return;
    onChange(next);
    onChangeEnd?.(next);
  };

  return (
    <View>
      <View style={st.row}>
        <IconButton icon="minus" size={36} onPress={() => nudge(-1)} accessibilityLabel={`${leftLabel} (−${step})`} />
        <View
          ref={trackRef}
          style={st.trackHit}
          onLayout={onTrackLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ min, max, now: value, text: valueText }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? 1 : -1)}
          {...pan.panHandlers}
        >
          {/* Décor insensible au toucher : la piste seule reçoit le geste. */}
          <View style={st.track} pointerEvents="none" />
          <LinearGradient
            colors={gradient.colors}
            locations={gradient.locations}
            start={gradient.start}
            end={gradient.end}
            style={[st.fill, { width: ratio * trackW }]}
            pointerEvents="none"
          />
          {Array.from({ length: steps + 1 }, (_, i) => (
            <View key={i} style={[st.tick, { left: (i / steps) * trackW - 1 }]} pointerEvents="none" />
          ))}
          <Animated.View style={[st.thumb, thumbStyle]} pointerEvents="none" />
        </View>
        <IconButton icon="plus" size={36} onPress={() => nudge(1)} accessibilityLabel={`${rightLabel} (+${step})`} />
      </View>
      <View style={st.labels}>
        <Text style={st.sideLabel}>{leftLabel}</Text>
        <Text style={st.valueLabel}>{valueText}</Text>
        <Text style={[st.sideLabel, st.rightLabel]}>{rightLabel}</Text>
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  row: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm },
  trackHit: { flex: 1, height: 44, justifyContent: "center" as const },
  // Le curseur du web (`.ctl-range`) : piste de verre lisérée, remplissage au
  // dégradé signature, pouce blanc cerclé de marque.
  track: {
    height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: t.colors.fill.medium,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle,
  },
  fill: { position: "absolute" as const, left: 0, height: TRACK_H, borderRadius: TRACK_H / 2 },
  tick: { position: "absolute" as const, width: 2, height: 2, borderRadius: 1, backgroundColor: t.colors.text.quaternary, top: 22 - 1 },
  thumb: {
    position: "absolute" as const, left: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: "#ffffff", borderWidth: 2, borderColor: withAlpha(t.colors.brand.violet, 0.9, t.colors.brand.violet),
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.55, shadowRadius: 2, elevation: 3,
  },
  labels: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginTop: 2, paddingHorizontal: 44 },
  sideLabel: { ...typography.small, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, flex: 1 },
  rightLabel: { textAlign: "right" as const },
  valueLabel: { ...typography.small, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
});
