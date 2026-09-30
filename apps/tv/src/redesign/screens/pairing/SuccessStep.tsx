import { memo } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Icon } from "../../icons/Icon";
import { colors, fonts, text } from "../../theme/tokens";
import { Glow } from "./Glow";

/**
 * Le jumelage a réussi : la coche verte (elle entre en s'agrandissant, sur
 * `transform` seulement), « Jumelage réussi ! », le compte accueilli par son
 * nom — et son portrait quand on l'a déjà — puis l'annonce de l'accueil, qui
 * s'ouvre seul deux secondes plus tard (l'intégration navigue).
 */

export const SuccessStep = memo(function SuccessStep({ userName, avatarUri }: { userName: string; avatarUri?: string }) {
  const { t } = useTranslation("pairing");
  return (
    <View style={styles.center}>
      <Animated.View entering={ZoomIn.springify().damping(14).stiffness(170)} style={styles.badgeWrap}>
        <Glow size={BADGE * 3} color={colors.success} opacity={0.42} style={styles.halo} />
        <View style={styles.badge}>
          <Icon name="check" size={84} color={colors.text} strokeWidth={3} />
        </View>
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(420).delay(120)} style={styles.texts}>
        <Text style={styles.title}>{t("pairingSuccess")}</Text>
        <View style={styles.welcome}>
          {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatar} fadeDuration={0} /> : null}
          <Text style={styles.welcomeText}>{t("welcomeUser", { username: userName })}</Text>
        </View>
      </Animated.View>
      <Animated.View entering={FadeIn.duration(400).delay(360)} style={styles.redirect}>
        <ActivityIndicator size="small" color={colors.textTertiary} />
        <Text style={styles.redirectText}>{t("redirectingHome")}</Text>
      </Animated.View>
    </View>
  );
});

const BADGE = 168;

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  badgeWrap: { width: BADGE * 1.6, height: BADGE * 1.6, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute" },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
  },
  texts: { alignItems: "center", gap: 22, marginTop: 30 },
  title: { ...text.title, fontSize: 76, lineHeight: 84, letterSpacing: -1.6, textAlign: "center" },
  welcome: { flexDirection: "row", alignItems: "center", gap: 18 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: "rgba(255, 255, 255, 0.2)" },
  welcomeText: { ...fonts.semibold, fontSize: 40, lineHeight: 50, color: colors.textSecondary },
  redirect: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 56 },
  redirectText: { ...fonts.medium, fontSize: 26, lineHeight: 34, color: colors.textTertiary },
});
