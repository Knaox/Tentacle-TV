import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import { DualTone, TONES, type Tone } from "./DualTone";
import type { TrackOptionModel } from "./playerTypes";

/**
 * Un choix du panneau des pistes : une piste audio, des sous-titres, un
 * palier de qualité. Le choix retenu porte la coche et un fond clair ; les
 * pastilles disent ce qui compte (DV, HDR, Atmos) et « Auto » quand le
 * plafond de débit a choisi à la place de l'utilisateur. Au focus : blanc,
 * texte noir, un peu plus grand.
 */

export const TrackOptionRow = memo(function TrackOptionRow({
  option,
  autoLabel,
  focusKey,
  onPress,
}: {
  option: TrackOptionModel;
  autoLabel: string;
  focusKey: string;
  onPress?: () => void;
}) {
  return (
    <FocusTarget focusKey={focusKey} onPress={onPress} accessibilityLabel={option.label}>
      {(focused) => <Body option={option} autoLabel={autoLabel} focused={focused} />}
    </FocusTarget>
  );
});

function Badge({ text, tone, accent }: { text: string; tone: Tone; accent?: boolean }) {
  const border = accent ? "transparent" : tone === "dark" ? scrim(0.4) : white(0.5);
  const background = accent ? (tone === "dark" ? colors.accentDeep : colors.accent) : "transparent";
  const color = accent ? colors.onAccent : TONES[tone].secondary;
  return (
    <View style={[styles.badge, { borderColor: border, backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

function Body({ option, autoLabel, focused }: { option: TrackOptionModel; autoLabel: string; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.03 * p.value }] }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const badges = option.badges ?? [];
  return (
    <Animated.View style={[styles.row, lift]}>
      {option.selected ? <View style={[StyleSheet.absoluteFill, styles.selected]} /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, styles.white, whiteLayer]} />
      <DualTone progress={p} style={styles.fill} contentStyle={styles.fillContent}>
        {(tone) => (
          <View style={styles.line}>
            <View style={styles.check}>
              {option.selected ? <Icon name="check" size={28} color={TONES[tone].primary} strokeWidth={2.8} /> : null}
            </View>
            <View style={styles.text}>
              <Text style={[option.selected ? styles.labelBold : styles.label, { color: TONES[tone].primary }]} numberOfLines={2}>
                {option.label}
              </Text>
              {option.detail || badges.length || option.auto ? (
                <View style={styles.meta}>
                  {option.detail ? <Text style={[styles.detail, { color: TONES[tone].tertiary }]}>{option.detail}</Text> : null}
                  {badges.map((badge) => <Badge key={badge} text={badge} tone={tone} />)}
                  {option.auto ? <Badge text={autoLabel} tone={tone} accent /> : null}
                </View>
              ) : null}
            </View>
          </View>
        )}
      </DualTone>
    </Animated.View>
  );
}

const RADIUS = 22;

const styles = StyleSheet.create({
  row: { borderRadius: RADIUS },
  selected: { borderRadius: RADIUS, backgroundColor: white(0.1) },
  white: { borderRadius: RADIUS, backgroundColor: colors.ctaBg },
  fill: { minHeight: 68 },
  fillContent: { flexGrow: 1, justifyContent: "center" },
  line: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingLeft: 16, paddingRight: 22 },
  check: { width: 32, alignItems: "center" },
  text: { flex: 1, gap: 8 },
  label: { ...fonts.medium, fontSize: 26, lineHeight: 32 },
  labelBold: { ...fonts.bold, fontSize: 26, lineHeight: 32 },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  detail: { ...fonts.semibold, fontSize: 22 },
  badge: { height: 32, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, justifyContent: "center" },
  badgeText: { ...fonts.bold, fontSize: 22, letterSpacing: 0.3 },
});
