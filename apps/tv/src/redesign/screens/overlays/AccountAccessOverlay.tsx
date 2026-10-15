import { memo, useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { ACCOUNT_ACCESS_SCREEN, confirmBlur, confirmPress, type AccountAccessScreenAction } from "@tentacle-tv/tv-core";
import { reopeningCopy, scheduleClock, type AccountAccessView } from "@tentacle-tv/shared";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim, text } from "../../theme/tokens";
import { ConfirmPill } from "../settings/ConfirmPill";

/**
 * La page d'un compte BLOQUÉ (désactivé, hors plage — docs/DROITS-UTILISATEURS.md
 * § 9.1) : tout l'écran est couvert, rien ne se referme tant que l'accès n'est
 * pas rétabli. La raison ; hors plage, les heures permises en clair et l'heure
 * de réouverture. Une seule action : « Changer de profil » (session de profil de
 * la Famille), ou « Se déconnecter du serveur » — le déjumelage, à DOUBLE appui
 * comme partout (tv-core `panels/confirmPress`).
 *
 * Contrat : la vue (shared `accountAccessView`) et l'action (tv-core
 * `decideAccountAccessScreen`) viennent de l'intégration, qui tient le focus
 * dans le panneau et laisse Retour quitter l'application. Clés de focus :
 * `access:action` ; groupe `access:panel`.
 */

export interface AccountAccessOverlayProps {
  view: AccountAccessView;
  action: AccountAccessScreenAction;
  onAction?: () => void;
}

const ICONS = { disabled: "lock", lockedOut: "lock", outsideSchedule: "clock" } as const;

export const AccountAccessOverlay = memo(function AccountAccessOverlay({ view, action, onAction }: AccountAccessOverlayProps) {
  const { t, i18n } = useTranslation(["accountAccess", "pairing"]);
  const backing = useNativeGlassBacking("strong");
  const [armed, setArmed] = useState<"unpair" | null>(null);

  const pressUnpair = useCallback(() => {
    const step = confirmPress(armed, "unpair");
    setArmed(step.armed);
    if (step.run) onAction?.();
  }, [armed, onAction]);
  const leaveUnpair = useCallback((focused: boolean) => {
    if (!focused) setArmed((current) => confirmBlur(current, "unpair"));
  }, []);

  const lang = i18n.language;
  const reopening = view.reopening ? reopeningCopy(view.reopening, lang) : null;

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.layer}>
      <View style={styles.veil} />
      <FocusGroup focusKey={ACCOUNT_ACCESS_SCREEN.group} style={styles.panel}>
        <View style={[StyleSheet.absoluteFill, styles.base, backing]} />
        <GlassSurface radius={RADIUS} tone="strong" style={StyleSheet.absoluteFill} elevated />
        <View style={styles.ring}>
          <Icon name={ICONS[view.variant]} size={64} color={colors.text} strokeWidth={2} />
        </View>
        <Text style={styles.title}>{t(`accountAccess:${view.titleKey}`)}</Text>
        <Text style={styles.message}>{t(`accountAccess:${view.bodyKey}`)}</Text>
        {view.lines.length > 0 ? (
          <View style={styles.hours}>
            <Text style={styles.hoursTitle}>{t("accountAccess:schedulesTitle")}</Text>
            {view.lines.map((line) => (
              <View key={`${line.day}-${line.start}-${line.end}`} style={styles.hoursRow}>
                <Text style={styles.hoursDay}>{t(`accountAccess:days.${line.day}`)}</Text>
                <Text style={styles.hoursRange}>
                  {t("accountAccess:range", {
                    from: scheduleClock(line.start, lang) ?? t("accountAccess:midnight"),
                    to: scheduleClock(line.end, lang) ?? t("accountAccess:midnight"),
                  })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {reopening ? <Text style={styles.reopening}>{t(`accountAccess:${reopening.key}`, reopening.params)}</Text> : null}
        <View style={styles.actions}>
          {action === "switchProfile" ? (
            <PillButton variant="primary" icon="user" label={t("accountAccess:actions.switchProfile")} focusKey={ACCOUNT_ACCESS_SCREEN.action} onPress={onAction} />
          ) : (
            <ConfirmPill
              label={t("accountAccess:actions.unpair")}
              icon="logout"
              tone="danger"
              armed={armed !== null}
              armedLabel={t("pairing:tvUnpairConfirm")}
              focusKey={ACCOUNT_ACCESS_SCREEN.action}
              onPress={pressUnpair}
              onFocusChange={leaveUnpair}
            />
          )}
        </View>
        <Text style={styles.footer}>{t(view.variant === "outsideSchedule" ? "accountAccess:footer" : "accountAccess:footerDisabled")}</Text>
      </FocusGroup>
    </Animated.View>
  );
});

const RADIUS = 48;

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: scrim(0.86) },
  panel: { width: 1120, alignItems: "center", paddingHorizontal: 80, paddingTop: 56, paddingBottom: 44, borderRadius: RADIUS },
  base: { borderRadius: RADIUS, backgroundColor: "rgba(10, 10, 14, 0.96)" },
  ring: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...text.title, marginTop: 28, textAlign: "center" },
  message: { ...fonts.regular, fontSize: 30, lineHeight: 42, color: colors.textSecondary, textAlign: "center", marginTop: 18 },
  hours: { alignSelf: "stretch", marginTop: 36, paddingHorizontal: 36, paddingVertical: 24, borderRadius: 28, backgroundColor: "rgba(255, 255, 255, 0.06)" },
  hoursTitle: { ...fonts.bold, fontSize: 22, letterSpacing: 1.6, color: colors.textTertiary, textTransform: "uppercase" },
  hoursRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  hoursDay: { ...fonts.regular, fontSize: 28, color: colors.textSecondary },
  hoursRange: { ...fonts.bold, fontSize: 28, color: colors.text, fontVariant: ["tabular-nums"] },
  reopening: { ...fonts.medium, fontSize: 30, color: colors.text, marginTop: 28, textAlign: "center" },
  actions: { flexDirection: "row", gap: 22, marginTop: 40 },
  footer: { ...fonts.regular, fontSize: 22, lineHeight: 32, color: colors.textTertiary, marginTop: 30, textAlign: "center" },
});
