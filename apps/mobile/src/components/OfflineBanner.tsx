import { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { CryingTentacle } from "./CryingTentacle";
import { Button } from "@/components/ui";
import { useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface OfflineBannerProps {
  visible: boolean;
  /** L'essai manuel est en cours — la pilule le montre (spinner + désactivée). */
  isChecking?: boolean;
  onRetry: () => void;
  onLogout?: () => void;
  onChangeServer?: () => void;
  /** « Passer hors ligne » — le voile du serveur injoignable seulement : la
   *  session expirée n'offre pas ce chemin. */
  onGoOffline?: () => void;
  /** Textes de remplacement (voile de session expirée) ; `hint: null` le retire. */
  title?: string;
  message?: string;
  hint?: string | null;
}

export function OfflineBanner({
  visible, isChecking, onRetry, onLogout, onChangeServer, onGoOffline, title, message, hint,
}: OfflineBannerProps) {
  // Les clés nues restent celles de `common` ; le bouton reprend `nav:goOffline`,
  // le libellé du profil — un seul texte par geste.
  const { t } = useTranslation(["common", "nav"]);
  const styles = useThemedStyles(makeStyles);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <View style={styles.content}>
        <CryingTentacle size={120} />
        <Text style={styles.title}>{title ?? t("offlineTitle")}</Text>
        <Text style={styles.message}>{message ?? t("offlineMessage")}</Text>
        {hint !== null && <Text style={styles.hint}>{hint ?? t("offlineHint")}</Text>}
        {/* Les pilules du socle — le Réessayer MONTRE l'essai en cours. */}
        <View style={styles.buttons}>
          <Button
            title={t("retryConnection")}
            onPress={onRetry}
            loading={isChecking}
            fullWidth
          />
          {/* La seule issue non destructive : avant « Se déconnecter », en rouge. */}
          {onGoOffline && (
            <Button title={t("nav:goOffline")} onPress={onGoOffline} variant="secondary" fullWidth />
          )}
          {onLogout && (
            <Button title={t("offlineLogout")} onPress={onLogout} variant="danger" fullWidth />
          )}
          {onChangeServer && (
            <Button title={t("changeServer")} onPress={onChangeServer} variant="secondary" fullWidth />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: withAlpha(t.colors.surface.s0, 0.95, t.colors.overlay.scrimHeavy),
      justifyContent: "center",
      alignItems: "center",
      zIndex: 999,
    },
    content: {
      alignItems: "center",
      paddingHorizontal: 32,
      width: "100%",
      maxWidth: 420,
    },
    title: {
      color: t.colors.text.primary,
      fontSize: 22,
      fontWeight: "700",
      marginTop: 24,
      textAlign: "center",
    },
    message: {
      color: t.colors.text.tertiary,
      fontSize: 14,
      marginTop: 12,
      textAlign: "center",
      lineHeight: 20,
    },
    hint: {
      color: t.colors.text.quaternary,
      fontSize: 12,
      marginTop: 8,
      textAlign: "center",
      lineHeight: 17,
    },
    buttons: {
      alignSelf: "stretch",
      gap: 12,
      marginTop: 28,
    },
  });
