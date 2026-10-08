import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  DB_MIGRATION_COPY, DB_MIGRATION_REASON_KEYS, dbMigrationEta, dbMigrationRetryClock, type DatabaseMigrationView,
} from "@tentacle-tv/shared";
import { TentacleLogo } from "@/components/TentacleLogo";
import { useThemedStyles, type AppTheme } from "@/theme";

/**
 * L'écran d'attente de la migration de la base (serveur 1.25), mobile : plein
 * écran, sans un bouton — il se met à jour et s'efface seul. Ni erreur, ni
 * hors ligne : le serveur répond, il change de base. Mots partagés (`errors`,
 * `dbMigration*`), aucun ne parle de transfert ni de copie vers l'appareil.
 */
export function DatabaseMigrationScreen({ view }: { view: DatabaseMigrationView }) {
  const { t } = useTranslation("errors");
  const styles = useThemedStyles(makeStyles);
  const migrating = view.kind === "migrating" ? view : null;
  const eta = migrating ? dbMigrationEta(migrating.etaSeconds) : null;
  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityLiveRegion="polite">
      <View style={styles.content}>
        <TentacleLogo size={96} />
        {migrating && eta ? (
          <>
            <Text style={styles.title} accessibilityRole="header">{t(DB_MIGRATION_COPY.title)}</Text>
            <Text style={styles.body}>{t(DB_MIGRATION_COPY.body)}</Text>
            <View
              style={styles.track}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: migrating.percent }}
            >
              <View style={[styles.fill, { width: `${Math.max(2, migrating.percent)}%` }]} />
            </View>
            <View style={styles.row}>
              <Text style={styles.percent}>{migrating.percent} %</Text>
              {migrating.total > 0 && (
                <Text style={styles.small}>{t(DB_MIGRATION_COPY.tables, { done: migrating.done, total: migrating.total })}</Text>
              )}
            </View>
            <Text style={styles.eta}>{t(eta.key, { minutes: eta.minutes })}</Text>
            <Text style={styles.footer}>{t(DB_MIGRATION_COPY.footer)}</Text>
          </>
        ) : view.kind === "failed" ? (
          <>
            <Text style={styles.title} accessibilityRole="header">{t(DB_MIGRATION_COPY.failedTitle)}</Text>
            <Text style={styles.body}>{t(DB_MIGRATION_COPY.failedBody)}</Text>
            <Text style={[styles.small, styles.reason]}>{t(DB_MIGRATION_REASON_KEYS[view.reason])}</Text>
            {/* Sans nouvel essai automatique (`retryInSeconds: null`), rien n'en est dit. */}
            {view.retryInSeconds !== null ? (
              <Text style={styles.eta}>
                {view.retryInSeconds > 0
                  ? t(DB_MIGRATION_COPY.retryIn, { time: dbMigrationRetryClock(view.retryInSeconds) })
                  : t(DB_MIGRATION_COPY.retryNow)}
              </Text>
            ) : null}
            <Text style={styles.footer}>{t(DB_MIGRATION_COPY.rollback)}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      // Opaque : l'écran remplace l'application le temps de la migration.
      backgroundColor: t.colors.surface.s0,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
      elevation: 1000,
    },
    content: { alignItems: "center", paddingHorizontal: 32, width: "100%", maxWidth: 440 },
    title: { color: t.colors.text.primary, fontSize: 22, fontWeight: "700", marginTop: 24, textAlign: "center" },
    body: { color: t.colors.text.tertiary, fontSize: 14, lineHeight: 20, marginTop: 12, textAlign: "center" },
    track: {
      alignSelf: "stretch", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 28, backgroundColor: t.colors.fill.soft,
    },
    fill: { height: "100%", borderRadius: 3, backgroundColor: t.colors.brand.violet },
    row: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
    percent: { color: t.colors.text.secondary, fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
    small: { color: t.colors.text.tertiary, fontSize: 12, lineHeight: 17, textAlign: "center", fontVariant: ["tabular-nums"] },
    reason: { marginTop: 14 },
    eta: { color: t.colors.text.secondary, fontSize: 14, fontWeight: "600", marginTop: 16, textAlign: "center" },
    footer: { color: t.colors.text.quaternary, fontSize: 12, lineHeight: 17, marginTop: 28, textAlign: "center" },
  });
