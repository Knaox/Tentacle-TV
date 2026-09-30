import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts } from "../../theme/tokens";
import { withAlpha } from "./withAlpha";

/**
 * « Jumelage expiré » : la sauvegarde de la progression est en pause (le
 * jeton Jellyfin de l'appareil est mort côté serveur). Un bandeau ambre, en
 * haut, NON focalisable — il informe sans voler le focus — qui disparaît de
 * lui-même dès qu'un jeton frais revient.
 *
 * Contrat : monté par l'app quand `useStreamingConfig(token).data?.tokenExpired`.
 */

export const ExpiredPairingBanner = memo(function ExpiredPairingBanner() {
  const { t } = useTranslation("pairing");
  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View entering={FadeInUp.duration(360)} style={styles.banner}>
        <View style={[StyleSheet.absoluteFill, styles.base]} />
        <GlassSurface radius={RADIUS} tone="strong" style={StyleSheet.absoluteFill} elevated />
        <View style={[StyleSheet.absoluteFill, styles.tint]} />
        <View style={styles.icon}>
          <Icon name="alert" size={30} color={colors.onAccent} strokeWidth={2.4} />
        </View>
        <Text style={styles.text}>{t("pairingExpiredBanner")}</Text>
      </Animated.View>
    </View>
  );
});

const RADIUS = 36;

const styles = StyleSheet.create({
  layer: { position: "absolute", top: TV_STAGE.safe.y, left: 0, right: 0, alignItems: "center" },
  banner: {
    maxWidth: 1240,
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    paddingVertical: 20,
    paddingLeft: 22,
    paddingRight: 36,
    borderRadius: RADIUS,
  },
  base: { borderRadius: RADIUS, backgroundColor: "rgba(18, 14, 8, 0.96)" },
  tint: { borderRadius: RADIUS, borderWidth: 1, borderColor: withAlpha(colors.accent, 0.55), backgroundColor: withAlpha(colors.accent, 0.1) },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  text: { ...fonts.semibold, flexShrink: 1, fontSize: 26, lineHeight: 36, color: colors.text },
});
