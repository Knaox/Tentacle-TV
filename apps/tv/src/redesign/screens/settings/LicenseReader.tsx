import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { settingsLicenseBlockKey } from "@tentacle-tv/tv-core";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import type { LicenseReaderModel } from "./settingsTypes";

/**
 * Le lecteur d'un document de licence, en surimpression : une grande feuille
 * de verre, le titre, et le texte en BLOCS de paragraphes (shared
 * `splitLicenseText`). Chaque bloc est une cible de focus sans action : HAUT
 * / BAS passent de bloc en bloc et le défilement suit. Le bloc qui a le focus
 * s'éclaire à peine — on lit, on n'agit pas.
 *
 * Aucune décision de focus : l'intégration ouvre sur le premier bloc, garde
 * le focus dans la feuille et la ferme au Retour.
 */
export const LicenseReader = memo(function LicenseReader({ reader }: { reader: LicenseReaderModel }) {
  const backing = useNativeGlassBacking("strong");
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.layer}>
      <View style={styles.veil} pointerEvents="none" />
      <View style={styles.sheet}>
        <View style={[StyleSheet.absoluteFill, styles.base, backing]} />
        <GlassSurface radius={RADIUS} tone="strong" style={StyleSheet.absoluteFill} elevated />
        <Text style={styles.title} numberOfLines={1}>{reader.title}</Text>
        <View style={styles.divider} />
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {reader.blocks.map((block, index) => (
            <FocusTarget key={index} focusKey={settingsLicenseBlockKey(index)} form="row" accessibilityLabel={block.slice(0, 120)}>
              {(focused) => <Block text={block} focused={focused} />}
            </FocusTarget>
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  );
});

function Block({ text, focused }: { text: string; focused: boolean }) {
  const p = useFocusProgress(focused);
  const light = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <View style={styles.block}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.blockFocus, light]} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const S = TV_STAGE.safe;
const RADIUS = 40;

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: scrim(0.6) },
  sheet: { position: "absolute", top: S.y, bottom: S.y, left: 260, right: 260, borderRadius: RADIUS },
  base: { borderRadius: RADIUS, backgroundColor: "rgba(10, 10, 14, 0.96)" },
  title: { ...fonts.bold, fontSize: 40, lineHeight: 48, letterSpacing: -0.4, color: colors.text, paddingHorizontal: 56, paddingTop: 44, paddingBottom: 26 },
  divider: { height: 1, marginHorizontal: 56, backgroundColor: white(0.1) },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 32, paddingTop: 20, paddingBottom: 60, gap: 4 },
  block: { borderRadius: 20, paddingHorizontal: 24, paddingVertical: 16 },
  blockFocus: { borderRadius: 20, backgroundColor: white(0.08) },
  text: { ...fonts.regular, fontSize: 24, lineHeight: 34, color: colors.textSecondary },
});
