import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TentacleLogo } from "../icons/TentacleLogo";
import { CheckIcon } from "../icons/TVIcons";
import { Colors, Radius, Typography } from "../../theme/colors";

interface PairingSuccessStepProps {
  username: string;
}

/**
 * Écran de succès du jumelage — badge vert animé (spring) + hiérarchie core :
 * titre blanc, accent porté par l'icône (pas de titre vert plat), et
 * indication de la redirection automatique vers l'accueil.
 */
export function PairingSuccessStep({ username }: PairingSuccessStepProps) {
  const { t } = useTranslation("pairing");

  // Entrée : carte en fade + translateY, badge en spring (cause → effet)
  const cardAnim = useSharedValue(0);
  const badgeScale = useSharedValue(0);

  useEffect(() => {
    cardAnim.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    badgeScale.value = withDelay(150, withSpring(1, { damping: 12, stiffness: 180 }));
  }, [cardAnim, badgeScale]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardAnim.value,
    transform: [{ translateY: (1 - cardAnim.value) * 24 }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, cardStyle]}>
        <TentacleLogo size={64} />

        {/* Badge succès — même langage visuel que la coche « vu » des épisodes */}
        <Animated.View style={[styles.badge, badgeStyle]}>
          <CheckIcon size={36} color={Colors.textPrimary} />
        </Animated.View>

        <Text style={styles.title}>{t("pairing:pairingSuccess")}</Text>
        <Text style={styles.subtitle}>
          {t("pairing:welcomeUser", { username })}
        </Text>

        {/* Redirection auto vers l'accueil (2s) — l'utilisateur sait quoi attendre */}
        <View style={styles.redirectRow}>
          <ActivityIndicator size="small" color={Colors.textTertiary} />
          <Text style={styles.redirectText}>
            {t("pairing:redirectingHome")}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: Colors.bgDeep,
  },
  card: {
    width: 540,
    padding: 48,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.buttonLarge,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: "center" as const,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.success,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginTop: 24,
    marginBottom: 24,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: "700" as const,
    marginBottom: 8,
    textAlign: "center" as const,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 18,
    textAlign: "center" as const,
  },
  redirectRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    marginTop: 28,
  },
  redirectText: {
    color: Colors.textTertiary,
    ...Typography.caption,
  },
};
