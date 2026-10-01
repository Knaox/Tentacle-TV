import { memo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { useNavFrame } from "../nav/navFrame";
import { colors, fonts, scrim } from "../theme/tokens";
import { RequestsPeek } from "./RequestsPeek";
import type { RequestsDockModel } from "./requestTypes";

/**
 * Les demandes en cours, dans le bloc du profil de la navigation — l'accessoire
 * du rail (`NavRailProps.accessory`), au-dessus du profil. Le dessin et le
 * focus d'une entrée : repliée, l'aperçu seul (`RequestsPeek`) ; ouverte, à
 * côté, « Mes demandes » et ce qu'il y a (« 3 demandes », « Rien en file
 * d'attente »). Focalisée, elle blanchit, texte noir. OK ouvre la liste.
 *
 * Clé de focus : `nav:Requests` — la barre s'ouvre quand elle l'a. Ce n'est
 * pas une page : elle ne s'organise pas (aucun appui long).
 */

const N = TV_STAGE.nav;

export const REQUESTS_DOCK_KEY = "nav:Requests";
/** La hauteur déclarée au rail : une entrée. */
export const REQUESTS_DOCK_HEIGHT = N.itemHeight;

export const RequestsDock = memo(function RequestsDock({ model, onSelect }: { model: RequestsDockModel; onSelect?: () => void }) {
  const { expanded, openness, itemWidth } = useNavFrame();
  const label = model.caption ? `${model.label}, ${model.caption}` : model.label;
  return (
    <FocusTarget focusKey={REQUESTS_DOCK_KEY} form="row" onPress={onSelect} accessibilityLabel={label}>
      {(focused) => <Body model={model} focused={focused} expanded={expanded} openness={openness} width={itemWidth} />}
    </FocusTarget>
  );
});

interface BodyProps {
  model: RequestsDockModel;
  focused: boolean;
  expanded: boolean;
  openness: SharedValue<number>;
  width: number;
}

function Body({ model, focused, expanded, openness, width }: BodyProps) {
  const p = useFocusProgress(focused);
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const lightText = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.04 * p.value }] }));
  const labelIn = useAnimatedStyle(() => ({ opacity: openness.value, transform: [{ translateX: -12 * (1 - openness.value) }] }));
  return (
    <Animated.View style={[{ width, height: N.itemHeight }, lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, whiteLayer]} />
      <View style={styles.row}>
        {/* Les affiches ne changent pas au focus, et ne se dessinent qu'une
            fois ; seul le bac vide passe au noir, en fondu. */}
        <View style={styles.glyph}>
          {model.posters.length > 0 ? (
            <RequestsPeek model={model} dark={false} />
          ) : (
            <>
              <Animated.View style={[StyleSheet.absoluteFill, lightText]}>
                <RequestsPeek model={model} dark={false} />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, whiteLayer]}>
                <RequestsPeek model={model} dark />
              </Animated.View>
            </>
          )}
        </View>
        {expanded ? (
          <Animated.View style={[styles.texts, labelIn]}>
            <Texts model={model} dark={false} style={lightText} />
            <Texts model={model} dark style={[StyleSheet.absoluteFill, whiteLayer]} />
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function Texts({ model, dark, style }: { model: RequestsDockModel; dark: boolean; style: StyleProp<ViewStyle> }) {
  return (
    <Animated.View style={[styles.textBox, style]}>
      <Text style={[styles.label, { color: dark ? colors.ctaFg : colors.textSecondary }]} numberOfLines={1}>
        {model.label}
      </Text>
      {model.caption ? (
        <Text style={[styles.caption, { color: dark ? scrim(0.6) : colors.textTertiary }]} numberOfLines={1}>
          {model.caption}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { height: N.itemHeight, flexDirection: "row", alignItems: "center" },
  glyph: { width: N.itemHeight, height: N.itemHeight },
  texts: { flex: 1, marginLeft: 4 },
  textBox: { justifyContent: "center" },
  label: { ...fonts.semibold, fontSize: 26 },
  caption: { ...fonts.medium, fontSize: 22, lineHeight: 26, marginTop: -1 },
  focusFill: { borderRadius: N.itemRadius, backgroundColor: colors.ctaBg },
});
