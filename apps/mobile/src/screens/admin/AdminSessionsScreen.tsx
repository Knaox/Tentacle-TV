import { Children, useState, type ReactNode } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, SubtleBackground } from "@/components/ui";
import { GroupRecipient, SessionRecipient } from "@/components/admin/sessions/ComposerRecipient";
import { DashboardToast, useDashboardToast } from "@/components/admin/sessions/DashboardToast";
import { SessionsSummary } from "@/components/admin/sessions/DeliveryChip";
import { IdleSessions } from "@/components/admin/sessions/IdleSessions";
import { MessageComposer } from "@/components/admin/sessions/MessageComposer";
import { SessionCard } from "@/components/admin/sessions/SessionCard";
import { WatchGroupCard } from "@/components/admin/sessions/WatchGroupCard";
import { useSessionsDashboard } from "@/hooks/admin/useSessionsDashboard";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { backOrHome } from "@/utils/backOrHome";
import { FONT_FAMILY, RADIUS, spacing, useContentPadding, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/** Au-delà, deux colonnes de cartes (tablette, téléphone couché large). */
const TWO_COLUMNS_MIN = 720;

/**
 * Sessions en direct — le tableau de bord du bureau 1.22.0, dans la poche de
 * l'administrateur : qui regarde quoi, comment le média arrive, et la main
 * pour mettre en pause, arrêter ou écrire. Les salles Watch Together ont leur
 * section ; un message, un arrêt, partent à tout le groupe.
 *
 * Tirer vers le bas relit l'instantané ; derrière un autre écran, plus une
 * requête. Deux colonnes dès que la largeur le permet.
 */
export function AdminSessionsScreen() {
  // Le serveur refuse ces routes à qui n'est pas administrateur ; l'écran,
  // lui, ne s'ouvre même pas (lien profond, retour d'historique…).
  if (!useIsAdmin()) return <Redirect href="/" />;
  return <Dashboard />;
}

function Dashboard() {
  const { t } = useTranslation("sessions");
  const { t: tc } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const padding = useContentPadding(1080);
  const twoColumns = width - padding * 2 >= TWO_COLUMNS_MIN;
  const { toast, show } = useDashboardToast();
  const d = useSessionsDashboard(show);
  const { data, query, playing } = d;
  // Seul le geste de l'utilisateur fait tourner l'anneau : la relève
  // automatique (toutes les 3 s) ne doit pas pousser la page à chaque fois.
  const [pulling, setPulling] = useState(false);
  const pull = () => {
    setPulling(true);
    void query.refetch().finally(() => setPulling(false));
  };

  return (
    <SubtleBackground>
      <View style={[st.root, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <View style={[st.header, { paddingHorizontal: padding }]}>
          <IconButton icon="←" onPress={() => backOrHome(router)} accessibilityLabel={tc("back")} />
          <Text style={st.title} numberOfLines={1} accessibilityRole="header">{t("title")}</Text>
          <View style={st.live} accessible accessibilityLabel={t("live")}>
            <View style={st.liveDot} />
            <Text style={st.liveTxt}>{t("live")}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[st.content, { paddingHorizontal: padding, paddingBottom: insets.bottom + 96 }]}
          refreshControl={
            <RefreshControl
              refreshing={pulling}
              onRefresh={pull}
              tintColor={theme.colors.brand.violet}
            />
          }
          indicatorStyle={Platform.OS === "ios" && theme.isDark ? "white" : "default"}
        >
          <View style={st.intro}>
            <Text style={st.description}>{t("description")}</Text>
            {data && <SessionsSummary sessions={playing} />}
          </View>

          {query.isLoading && (
            <Columns two={twoColumns}>
              <View style={st.skeleton} />
              <View style={st.skeleton} />
            </Columns>
          )}

          {query.isError && !data && (
            <View style={st.notice} accessibilityRole="alert">
              <Text style={st.noticeTxt}>{t("loadError")}</Text>
              <Pressable onPress={() => void query.refetch()} accessibilityRole="button" style={st.retry}>
                <Feather name="refresh-cw" size={14} color={theme.colors.text.primary} />
                <Text style={st.retryTxt}>{t("retry")}</Text>
              </Pressable>
            </View>
          )}

          {data && playing.length === 0 && data.groups.length === 0 && (
            <View style={st.empty}>
              <Feather name="monitor" size={30} color={theme.colors.text.quaternary} />
              <Text style={st.emptyTitle}>{t("empty")}</Text>
              <Text style={st.emptyHint}>{t("emptyHint")}</Text>
            </View>
          )}

          {data && playing.length > 0 && (
            <Section title={t("sectionPlaying")} count={playing.length}>
              <Columns two={twoColumns}>
                {playing.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    now={d.now}
                    clockOffsetMs={data.clockOffsetMs}
                    actions={d.actions}
                    feedback={d.feedback.entries.get(session.id)}
                  />
                ))}
              </Columns>
            </Section>
          )}

          {data && data.groups.length > 0 && (
            <Section title={t("sectionGroups")} count={data.groups.length}>
              <Columns two={twoColumns}>
                {data.groups.map((group) => (
                  <WatchGroupCard
                    key={group.groupId}
                    group={group}
                    sessionsById={d.sessionsById}
                    now={d.now}
                    clockOffsetMs={data.clockOffsetMs}
                    feedback={d.feedback.entries.get(group.groupId)}
                    onMessage={d.onGroupMessage}
                    onStop={d.onGroupStop}
                  />
                ))}
              </Columns>
            </Section>
          )}

          {data && d.idle.length > 0 && (
            <Section title={t("sectionIdle")} count={d.idle.length}>
              <IdleSessions sessions={d.idle} now={d.now} feedback={d.feedback.entries} onMessage={d.actions.onMessage} />
            </Section>
          )}
        </ScrollView>

        <DashboardToast toast={toast} />

        {d.composer !== null && (
          <MessageComposer
            title={d.composer.kind === "session" ? t("composerTitle", { name: d.composer.session.userName }) : t("composerGroupTitle")}
            recipient={d.composer.kind === "session"
              ? <SessionRecipient session={d.composer.session} />
              : <GroupRecipient group={d.composer.group} />}
            previewName={d.composer.kind === "session" ? d.composer.session.userName : null}
            pending={d.sending}
            failed={d.composerFailed}
            onSend={d.send}
            onClose={() => d.setComposer(null)}
          />
        )}
      </View>
    </SubtleBackground>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.section}>
      <View style={st.sectionHead}>
        <Text style={st.sectionTitle} accessibilityRole="header">{title}</Text>
        <Text style={st.sectionCount}>{count}</Text>
      </View>
      {children}
    </View>
  );
}

/** Deux colonnes en quinconce (les cartes n'ont pas la même hauteur), ou une seule. */
function Columns({ two, children }: { two: boolean; children: ReactNode }) {
  // `toArray` garde les clés des cartes : une session qui part n'en remonte pas une autre.
  const items = Children.toArray(children);
  if (!two) return <View style={styles.column}>{items}</View>;
  return (
    <View style={styles.columns}>
      <View style={styles.column}>{items.filter((_, i) => i % 2 === 0)}</View>
      <View style={styles.column}>{items.filter((_, i) => i % 2 === 1)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  column: { flex: 1, gap: spacing.md },
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md, marginBottom: spacing.md },
    title: { flex: 1, fontSize: 24, fontFamily: FONT_FAMILY.extrabold, letterSpacing: -0.4, color: t.colors.text.primary },
    live: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      height: 28,
      paddingHorizontal: 10,
      borderRadius: RADIUS.pill,
      backgroundColor: t.colors.statusPairs.success.bg,
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.colors.status.success },
    liveTxt: { fontSize: 12, fontFamily: FONT_FAMILY.semibold, color: t.colors.statusPairs.success.fg },
    content: { gap: spacing.xl, paddingTop: spacing.xs },
    intro: { gap: spacing.md },
    description: { fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    skeleton: { height: 260, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: t.colors.border.subtle, backgroundColor: t.colors.fill.faint },
    notice: { gap: spacing.md, padding: spacing.lg, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: t.colors.border.subtle, backgroundColor: t.colors.surface.s1 },
    noticeTxt: { fontSize: 14, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
    retry: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      alignSelf: "flex-start" as const,
      gap: 6,
      height: 40,
      paddingHorizontal: 16,
      borderRadius: RADIUS.pill,
      backgroundColor: t.colors.fill.soft,
    },
    retryTxt: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    empty: {
      alignItems: "center" as const,
      gap: 8,
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.faint,
    },
    emptyTitle: { fontSize: 16, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, textAlign: "center" as const },
    emptyHint: { fontSize: 14, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary, textAlign: "center" as const },
    section: { gap: spacing.md },
    sectionHead: { flexDirection: "row" as const, alignItems: "baseline" as const, gap: 8 },
    sectionTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, letterSpacing: -0.2 },
    sectionCount: { fontSize: 14, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, fontVariant: ["tabular-nums"] },
  });
