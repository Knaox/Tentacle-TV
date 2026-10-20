import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { AccountAccessPage } from "@tentacle-tv/api-client";
import { accountAccessView, reopeningCopy, scheduleClock } from "@tentacle-tv/shared";
import { TentacleLogo } from "@/components/TentacleLogo";
import { Button } from "@/components/ui";
import { useThemedStyles, type AppTheme } from "@/theme";
import type { AccountAccessAction } from "./accountAccessModel";

const ACTION_KEYS: Record<AccountAccessAction, string> = {
  switchProfile: "actions.switchProfile",
  signOut: "actions.signOut",
  changeServer: "actions.changeServer",
};

interface Props {
  page: AccountAccessPage;
  actions: readonly AccountAccessAction[];
  onAction: (action: AccountAccessAction) => void;
}

/**
 * La page d'un compte BLOQUÉ sur le mobile et la tablette (docs/DROITS-UTILISATEURS.md
 * § 9.1, § 9.10) : elle remplace l'application. Désactivé : la raison, et que
 * Jellyfin a fermé ses sessions ; hors de ses heures : les heures permises et la
 * réouverture, la page se lève seule ; réactivé sur un jeton mort : « Se
 * reconnecter ». Les mots sont ceux du web et de la TV (espace `accountAccess`).
 */
export function AccountAccessScreen({ page, actions, onAction }: Props) {
  const { t, i18n } = useTranslation("accountAccess");
  const styles = useThemedStyles(makeStyles);
  const view = useMemo(() => (page.state === "reconnect" ? null : accountAccessView(page, Date.now())), [page]);
  const lang = i18n.language;
  const reopening = view?.reopening ? reopeningCopy(view.reopening, lang) : null;
  const clock = (minutes: number) => scheduleClock(minutes, lang) ?? t("midnight");

  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityLiveRegion="polite">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <TentacleLogo size={88} />
          <Text style={styles.title} accessibilityRole="header">{t(view ? view.titleKey : "reconnect.title")}</Text>
          <Text style={styles.body}>{t(view ? view.bodyKey : "reconnect.body")}</Text>
          {view && view.lines.length > 0 ? (
            <View style={styles.hours}>
              <Text style={styles.hoursTitle}>{t("schedulesTitle")}</Text>
              {view.lines.map((line) => (
                <View key={`${line.day}-${line.start}-${line.end}`} style={styles.hourRow}>
                  <Text style={styles.day}>{t(`days.${line.day}`)}</Text>
                  <Text style={styles.range}>{t("range", { from: clock(line.start), to: clock(line.end) })}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {reopening ? <Text style={styles.reopening}>{t(reopening.key, reopening.params)}</Text> : null}
          <View style={styles.actions}>
            {page.state === "reconnect" ? (
              <Button title={t("actions.reconnect")} onPress={() => onAction("signOut")} fullWidth />
            ) : (
              actions.map((action, index) => (
                <Button
                  key={action}
                  title={t(ACTION_KEYS[action])}
                  variant={index === 0 ? "primary" : "secondary"}
                  onPress={() => onAction(action)}
                  fullWidth
                />
              ))
            )}
          </View>
          {view ? <Text style={styles.footer}>{t(view.variant === "outsideSchedule" ? "footer" : "footerDisabled")}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: t.colors.surface.s0, zIndex: 1000, elevation: 1000 },
    scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 48 },
    content: { alignItems: "center", paddingHorizontal: 24, width: "100%", maxWidth: 460 },
    title: { color: t.colors.text.primary, fontSize: 22, fontWeight: "700", marginTop: 24, textAlign: "center" },
    body: { color: t.colors.text.tertiary, fontSize: 15, lineHeight: 21, marginTop: 12, textAlign: "center" },
    hours: { alignSelf: "stretch", marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: t.colors.fill.soft },
    hoursTitle: { color: t.colors.text.tertiary, fontSize: 12, fontWeight: "600", textTransform: "uppercase", marginBottom: 8 },
    hourRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
    day: { color: t.colors.text.secondary, fontSize: 14, flexShrink: 1 },
    range: { color: t.colors.text.primary, fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
    reopening: { color: t.colors.text.primary, fontSize: 14, fontWeight: "600", marginTop: 16, textAlign: "center" },
    actions: { alignSelf: "stretch", gap: 12, marginTop: 28 },
    footer: { color: t.colors.text.quaternary, fontSize: 12, lineHeight: 17, marginTop: 24, textAlign: "center" },
  });
