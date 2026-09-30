import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useTranslation } from "react-i18next";
import { GlassSurface } from "../../glass/GlassSurface";
import { LiquidGlassProvider } from "../../glass/liquidGlassMode";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim } from "../../theme/tokens";

/**
 * L'explication par l'image de l'interrupteur Liquid Glass : la même scène
 * — une pilule et un rond de verre posés sur une œuvre — dans les deux
 * verres, côte à côte. Chaque vignette force SON verre (fournisseur local) ;
 * celle qui correspond au réglage porte « Actuel ». Rien n'y est focalisable.
 */

const GAP = 32;

export const GlassPreview = memo(function GlassPreview({ width, liquid, imageUri }: {
  width: number;
  /** Le réglage en cours (vrai = Liquid Glass). */
  liquid: boolean;
  /** Un fond d'œuvre : le verre se juge sur une image. */
  imageUri?: string;
}) {
  const { t } = useTranslation(["preferences", "common"]);
  const tile = Math.floor((width - GAP) / 2);
  return (
    <View style={styles.row}>
      <Sample width={tile} liquid label={t("preferences:liquidGlassTitle")} current={liquid} imageUri={imageUri} />
      <Sample width={tile} liquid={false} label={t("preferences:glassClassic")} current={!liquid} imageUri={imageUri} />
    </View>
  );
});

function Sample({ width, liquid, label, current, imageUri }: {
  width: number;
  liquid: boolean;
  label: string;
  current: boolean;
  imageUri?: string;
}) {
  const { t } = useTranslation(["preferences", "common"]);
  const height = Math.round((width * 9) / 16);
  return (
    <View style={{ width }}>
      <View style={[styles.frame, { width, height }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
        ) : (
          <LinearGradient colors={[colors.accentDeep, colors.surface3]} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient colors={[scrim(0), scrim(0.5)]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
        <LiquidGlassProvider enabled={liquid}>
          <View style={styles.mock}>
            <GlassSurface radius={30} tone="clear" style={styles.pill}>
              <Icon name="play" size={24} color={colors.text} />
              <Text style={styles.pillText}>{t("common:play")}</Text>
            </GlassSurface>
            <GlassSurface radius={30} tone="clear" style={styles.round}>
              <Icon name="plus" size={26} color={colors.text} strokeWidth={2.4} />
            </GlassSurface>
          </View>
        </LiquidGlassProvider>
        <View style={styles.ring} pointerEvents="none" />
      </View>
      <View style={styles.caption}>
        <Text style={[styles.label, current && styles.labelCurrent]}>{label}</Text>
        {current ? (
          <View style={styles.current}>
            <Icon name="check" size={20} color={colors.onAccent} strokeWidth={3} />
            <Text style={styles.currentText}>{t("preferences:glassCurrent")}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: GAP },
  frame: { borderRadius: 26, overflow: "hidden", backgroundColor: colors.surface2 },
  ring: { ...StyleSheet.absoluteFillObject, borderRadius: 26, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.12)" },
  mock: { position: "absolute", left: 28, bottom: 28, flexDirection: "row", gap: 16 },
  pill: { height: 60, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 28 },
  pillText: { ...fonts.bold, fontSize: 24, color: colors.text },
  round: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  caption: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 18 },
  label: { ...fonts.semibold, fontSize: 26, lineHeight: 34, color: colors.textSecondary },
  labelCurrent: { ...fonts.bold, color: colors.text },
  current: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: colors.accent,
  },
  currentText: { ...fonts.bold, fontSize: 22, color: colors.onAccent },
});
