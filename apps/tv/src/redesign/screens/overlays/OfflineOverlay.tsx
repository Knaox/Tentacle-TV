import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { BrandMark } from "../../brand/BrandMark";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim, text } from "../../theme/tokens";
import { ConfirmPill } from "../settings/ConfirmPill";

/**
 * Le serveur ne répond plus : tout l'écran est couvert, et rien ne se
 * referme tant que la connexion n'est pas revenue. La pieuvre pleure, deux
 * phrases disent ce qui se passe et que ce n'est pas la faute de
 * l'utilisateur, et deux gestes : réessayer, ou se déconnecter.
 *
 * Posé sur l'écran courant (l'accueil, le plus souvent), sous un voile
 * dense. Contrat : monté par l'app quand `useServerReachable` tombe ;
 * `onRetry` relance le test (`retrying` pendant qu'il court), `onLogout`
 * purge la session et revient au jumelage. Le focus reste DANS le panneau
 * et Retour quitte l'application : c'est l'intégration qui le tient.
 *
 * Clés de focus : `offline:retry`, `offline:logout` ; groupe
 * `offline:panel` (le panneau, où l'intégration retient le focus).
 */

export interface OfflineOverlayProps {
  /** Le serveur injoignable, en petit : ce qu'on dira à l'administrateur. */
  serverUrl?: string;
  retrying?: boolean;
  onRetry?: () => void;
  onLogout?: () => void;
}

export const OfflineOverlay = memo(function OfflineOverlay({ serverUrl, retrying = false, onRetry, onLogout }: OfflineOverlayProps) {
  const { t } = useTranslation("common");
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.layer}>
      <View style={styles.veil} />
      <FocusGroup focusKey="offline:panel" style={styles.panel}>
        <View style={[StyleSheet.absoluteFill, styles.base]} />
        <GlassSurface radius={RADIUS} tone="strong" style={StyleSheet.absoluteFill} elevated />
        <BrandMark size={176} crying />
        <Text style={styles.title}>{t("offlineTitle")}</Text>
        <Text style={styles.message}>{t("offlineMessage")}</Text>
        <Text style={styles.hint}>{t("offlineHint")}</Text>
        <View style={styles.actions}>
          <PillButton
            variant="primary"
            icon="refresh"
            label={retrying ? t("retrying") : t("retryConnection")}
            focusKey="offline:retry"
            onPress={retrying ? undefined : onRetry}
          />
          <ConfirmPill label={t("offlineLogout")} icon="logout" tone="danger" focusKey="offline:logout" onPress={onLogout} />
        </View>
        {serverUrl ? (
          <View style={styles.server}>
            <Icon name="wifiOff" size={24} color={colors.textTertiary} />
            <Text style={styles.serverText} numberOfLines={1}>{serverUrl}</Text>
          </View>
        ) : null}
      </FocusGroup>
    </Animated.View>
  );
});

const RADIUS = 48;

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: scrim(0.78) },
  panel: {
    width: 1120,
    alignItems: "center",
    paddingHorizontal: 80,
    paddingTop: 56,
    paddingBottom: 48,
    borderRadius: RADIUS,
  },
  base: { borderRadius: RADIUS, backgroundColor: "rgba(10, 10, 14, 0.96)" },
  title: { ...text.title, marginTop: 26, textAlign: "center" },
  message: { ...fonts.regular, fontSize: 30, lineHeight: 42, color: colors.textSecondary, textAlign: "center", marginTop: 20 },
  hint: { ...fonts.regular, fontSize: 24, lineHeight: 34, color: colors.textTertiary, textAlign: "center", marginTop: 16 },
  actions: { flexDirection: "row", gap: 22, marginTop: 44 },
  server: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 34 },
  serverText: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
});
