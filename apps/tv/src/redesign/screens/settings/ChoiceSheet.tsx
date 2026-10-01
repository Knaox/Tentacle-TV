import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim } from "../../theme/tokens";
import type { ChoiceListModel } from "./settingsTypes";

/**
 * La grande liste de choix d'un réglage (langue audio, mode et langue des
 * sous-titres), en surimpression : un voile sur tout l'écran, et à droite
 * une feuille de verre posée sur un fond DENSE — le verre dessiné ne floute
 * rien, le contenu derrière brouillerait les libellés ; le verre natif
 * floute, il prend le fond commun (`glass/glassBacking`). La valeur
 * retenue porte la coche rose de la marque ; celle qui a le focus devient
 * blanche.
 *
 * Aucune décision de focus : l'intégration pose l'entrée sur la valeur
 * retenue, garde le focus dans la feuille, et la ferme au Retour (elle
 * remet simplement la liste à `null`).
 */

export interface ChoiceSheetProps {
  list: ChoiceListModel;
  onChoose?: (value: string) => void;
}

const S = TV_STAGE.safe;
const WIDTH = 800;
const RADIUS = 40;
const ROW = 80;

export const ChoiceSheet = memo(function ChoiceSheet({ list, onChoose }: ChoiceSheetProps) {
  const backing = useNativeGlassBacking("strong");
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.layer}>
      <View style={styles.veil} pointerEvents="none" />
      <View style={styles.sheet}>
        <View style={[StyleSheet.absoluteFill, styles.base, backing]} />
        <GlassSurface radius={RADIUS} tone="strong" style={StyleSheet.absoluteFill} elevated />
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{list.title}</Text>
          {list.context ? <Text style={styles.context} numberOfLines={1}>{list.context}</Text> : null}
        </View>
        <View style={styles.divider} />
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {list.options.map((option, index) => (
            <FocusTarget
              key={option.value || "none"}
              focusKey={`settings:choice:${index}`}
              form="row"
              onPress={onChoose ? () => onChoose(option.value) : undefined}
              accessibilityLabel={option.label}
            >
              {(focused) => <Row label={option.label} selected={option.value === list.selected} focused={focused} />}
            </FocusTarget>
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  );
});

function Line({ label, selected, dark }: { label: string; selected: boolean; dark: boolean }) {
  const color = dark ? colors.ctaFg : selected ? colors.text : colors.textSecondary;
  return (
    <View style={styles.row}>
      <Text style={[selected ? styles.labelSelected : styles.label, { color }]} numberOfLines={1}>{label}</Text>
      {selected ? <Icon name="check" size={30} color={dark ? colors.accentDeep : colors.accent} strokeWidth={2.8} /> : null}
    </View>
  );
}

function Row({ label, selected, focused }: { label: string; selected: boolean; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.03 * p.value }] }));
  const onLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={[styles.rowBox, lift]}>
      {selected ? <View style={[StyleSheet.absoluteFill, styles.selectedFill]} /> : null}
      <Line label={label} selected={selected} dark={false} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, onLayer]}>
        <Line label={label} selected={selected} dark />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: scrim(0.6) },
  sheet: { position: "absolute", top: S.y, bottom: S.y, right: S.x, width: WIDTH, borderRadius: RADIUS },
  base: { borderRadius: RADIUS, backgroundColor: "rgba(10, 10, 14, 0.96)" },
  header: { paddingHorizontal: 48, paddingTop: 44, paddingBottom: 26, gap: 6 },
  title: { ...fonts.bold, fontSize: 40, lineHeight: 48, letterSpacing: -0.4, color: colors.text },
  context: { ...fonts.medium, fontSize: 26, lineHeight: 34, color: colors.textTertiary },
  divider: { height: 1, marginHorizontal: 48, backgroundColor: "rgba(255, 255, 255, 0.1)" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 30, paddingTop: 20, paddingBottom: 40, gap: 6 },
  rowBox: { height: ROW, borderRadius: 24 },
  row: { height: ROW, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 28, gap: 16 },
  label: { ...fonts.medium, fontSize: 30, flexShrink: 1 },
  labelSelected: { ...fonts.bold, fontSize: 30, flexShrink: 1 },
  selectedFill: { borderRadius: 24, backgroundColor: "rgba(255, 255, 255, 0.08)" },
  focusFill: { borderRadius: 24, backgroundColor: colors.ctaBg },
});
