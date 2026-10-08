import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import {
  DB_MIGRATION_COPY, DB_MIGRATION_REASON_KEYS, dbMigrationEta, dbMigrationRetryClock, type DatabaseMigrationView,
} from "@tentacle-tv/shared";
import { BrandMark } from "../../brand/BrandMark";
import { BrandGradient } from "../../brand/BrandGradient";
import { GlassSurface } from "../../glass/GlassSurface";
import { colors, fonts, scrim, text, white } from "../../theme/tokens";

/**
 * La base du serveur change de moteur (1.25) : l'écran d'attente, plein
 * écran, SANS RIEN de focalisable — il n'y a rien à décider, il se met à jour
 * et s'efface seul. La pieuvre en illustration (elle ne pleure pas : rien
 * n'est cassé), le titre, une phrase, la progression au dégradé de marque,
 * le temps restant ; en échec, le motif, le prochain essai et le retour
 * possible à la version d'avant. Mots partagés (`errors`, `dbMigration*`).
 *
 * Contrat : monté par l'intégration quand la décision de tv-core
 * (`decideMigrationScreen`) dit `show`, au-dessus des écrans qu'elle a passés
 * sans vue native. Aucune clé de focus.
 */
export const MigrationOverlay = memo(function MigrationOverlay({ view }: { view: DatabaseMigrationView }) {
  const { t } = useTranslation("errors");
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.layer}>
      <View style={styles.veil} />
      <View style={styles.panel}>
        <GlassSurface radius={RADIUS} tone="strong" style={StyleSheet.absoluteFill} elevated />
        <BrandMark size={160} />
        {view.kind === "migrating" ? <Migrating view={view} t={t} /> : <Failed view={view} t={t} />}
      </View>
    </Animated.View>
  );
});

type T = (key: string, options?: Record<string, unknown>) => string;

function Migrating({ view, t }: { view: Extract<DatabaseMigrationView, { kind: "migrating" }>; t: T }) {
  const eta = dbMigrationEta(view.etaSeconds);
  return (
    <>
      <Text style={styles.title}>{t(DB_MIGRATION_COPY.title)}</Text>
      <Text style={styles.message}>{t(DB_MIGRATION_COPY.body)}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(2, view.percent)}%` }]}>
          <BrandGradient />
        </View>
      </View>
      <View style={styles.row}>
        <Text style={styles.percent}>{view.percent} %</Text>
        {view.total > 0 ? <Text style={styles.meta}>{t(DB_MIGRATION_COPY.tables, { done: view.done, total: view.total })}</Text> : null}
      </View>
      <Text style={styles.eta}>{t(eta.key, { minutes: eta.minutes })}</Text>
      <Text style={styles.footer}>{t(DB_MIGRATION_COPY.footer)}</Text>
    </>
  );
}

function Failed({ view, t }: { view: Extract<DatabaseMigrationView, { kind: "failed" }>; t: T }) {
  return (
    <>
      <Text style={styles.title}>{t(DB_MIGRATION_COPY.failedTitle)}</Text>
      <Text style={styles.message}>{t(DB_MIGRATION_COPY.failedBody)}</Text>
      <Text style={styles.reason}>{t(DB_MIGRATION_REASON_KEYS[view.reason])}</Text>
      <Text style={styles.eta}>
        {view.retryInSeconds > 0
          ? t(DB_MIGRATION_COPY.retryIn, { time: dbMigrationRetryClock(view.retryInSeconds) })
          : t(DB_MIGRATION_COPY.retryNow)}
      </Text>
      <Text style={styles.footer}>{t(DB_MIGRATION_COPY.rollback)}</Text>
    </>
  );
}

const RADIUS = 48;

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 1000 },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: scrim(0.92) },
  panel: { width: 1120, alignItems: "center", paddingHorizontal: 80, paddingTop: 56, paddingBottom: 52, borderRadius: RADIUS },
  title: { ...text.title, marginTop: 26, textAlign: "center" },
  message: { ...fonts.regular, fontSize: 30, lineHeight: 42, color: colors.textSecondary, textAlign: "center", marginTop: 20 },
  track: { alignSelf: "stretch", height: 12, borderRadius: 6, overflow: "hidden", marginTop: 44, backgroundColor: white(0.12) },
  fill: { height: "100%", borderRadius: 6, overflow: "hidden" },
  row: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  percent: { ...fonts.bold, fontSize: 26, color: colors.text, fontVariant: ["tabular-nums"] },
  meta: { ...text.meta, fontVariant: ["tabular-nums"] },
  eta: { ...fonts.medium, fontSize: 28, lineHeight: 38, color: colors.text, textAlign: "center", marginTop: 26 },
  reason: { ...fonts.regular, fontSize: 26, lineHeight: 36, color: colors.textSecondary, textAlign: "center", marginTop: 18 },
  footer: { ...text.caption, textAlign: "center", marginTop: 30 },
});
