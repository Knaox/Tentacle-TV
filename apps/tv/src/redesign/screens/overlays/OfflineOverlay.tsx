import { memo, useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { BrandMark } from "../../brand/BrandMark";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim, text } from "../../theme/tokens";
import { ConfirmPill } from "../settings/ConfirmPill";

/**
 * Le serveur ne répond plus : tout l'écran est couvert, et rien ne se
 * referme tant que la connexion n'est pas revenue. La pieuvre pleure, deux
 * phrases disent ce qui se passe et que ce n'est pas la faute de
 * l'utilisateur, et deux gestes : réessayer, ou déjumeler l'appareil — la
 * sortie quand le serveur est hors service pour de bon.
 *
 * « Déjumeler cet appareil » se fait à DOUBLE appui, comme « Déconnexion »
 * dans les réglages : le premier arme (« Confirmer le déjumelage », et une
 * ligne dit ce qui va se passer), le second exécute, quitter le bouton
 * désarme. L'état armé est un état d'AFFICHAGE, local à la vue ;
 * `initialArmed` le pose à l'ouverture (banc).
 *
 * Posé sur l'écran courant (l'accueil, le plus souvent), sous un voile
 * dense. Contrat : monté par l'app quand `useServerReachable` tombe ;
 * `onRetry` relance le test (`retrying` pendant qu'il court), `onUnpair`
 * efface tout ce qui lie la TV au compte, sans attendre le réseau, et revient
 * au jumelage. Le focus reste DANS le panneau et Retour quitte l'application :
 * c'est l'intégration qui le tient.
 *
 * Clés de focus : `offline:retry`, `offline:unpair` ; groupe
 * `offline:panel` (le panneau, où l'intégration retient le focus).
 */

export interface OfflineOverlayProps {
  /** Le serveur injoignable, en petit : ce qu'on dira à l'administrateur. */
  serverUrl?: string;
  retrying?: boolean;
  initialArmed?: boolean;
  onRetry?: () => void;
  onUnpair?: () => void;
}

export const OfflineOverlay = memo(function OfflineOverlay({
  serverUrl,
  retrying = false,
  initialArmed = false,
  onRetry,
  onUnpair,
}: OfflineOverlayProps) {
  const { t } = useTranslation("common");
  const backing = useNativeGlassBacking("strong");
  const [armed, setArmed] = useState(initialArmed);

  const pressUnpair = useCallback(() => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    onUnpair?.();
  }, [armed, onUnpair]);

  const leaveUnpair = useCallback((focused: boolean) => {
    if (!focused) setArmed(false);
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.layer}>
      <View style={styles.veil} />
      <FocusGroup focusKey="offline:panel" style={styles.panel}>
        <View style={[StyleSheet.absoluteFill, styles.base, backing]} />
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
          <ConfirmPill
            label={t("offlineUnpair")}
            icon="logout"
            tone="danger"
            armed={armed}
            armedLabel={t("offlineUnpairConfirm")}
            focusKey="offline:unpair"
            onPress={pressUnpair}
            onFocusChange={leaveUnpair}
          />
        </View>
        {/* Toujours là, invisible au repos : armer ne décale rien. */}
        <View style={[styles.armedHint, { opacity: armed ? 1 : 0 }]}>
          <Icon name="alert" size={26} color={colors.accent} strokeWidth={2.4} />
          <Text style={styles.armedText} numberOfLines={1}>{t("offlineUnpairHint")}</Text>
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
  armedHint: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 24 },
  // La ligne armée des réglages (`AccountPanel`), au même ton.
  armedText: { ...fonts.regular, fontSize: 26, lineHeight: 36, color: colors.accentLight },
  server: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 26 },
  serverText: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
});
