import { useCallback, useMemo, useState } from "react";
import { Alert, SectionList, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import {
  formatNotifTitle,
  groupNotificationsByDay,
  notificationAgo,
  notificationHasDestination,
  notificationNeedsPlugins,
  notifBodyText,
  type AppNotification,
} from "@tentacle-tv/api-client";
import {
  useDeleteAllNotificationsMobile,
  useDeleteNotificationMobile,
  useDeleteNotificationsMobile,
  useMarkAllReadMobile,
  useMarkReadMobile,
  useNotificationsMobile,
} from "@/hooks/useNotificationsMobile";
import { toNotifPluginMeta, useActivePlugins } from "@/hooks/useActivePlugins";
import { ProblemState } from "@/components/problems/ProblemState";
import { usePageProblem } from "@/components/problems/usePageProblem";
import { useOpenNotification } from "@/notifications/useOpenNotification";
import { spacing, typography, useTheme } from "@/theme";
import { NotifSheetHeader } from "./NotifSheetHeader";
import { SwipeableNotifRow } from "./SwipeableNotifRow";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** « il y a … » des clés du mobile, la date au-delà d'une semaine (règle partagée). */
function formatAgo(createdAt: string, t: Translate, locale: string): string {
  const ago = notificationAgo(createdAt);
  switch (ago.unit) {
    case "now": return t("justNow");
    case "minutes": return t("minutesAgo", { count: ago.count });
    case "hours": return t("hoursAgo", { count: ago.count });
    case "days": return t("daysAgo", { count: ago.count });
    default: return ago.date.toLocaleDateString(locale);
  }
}

/**
 * Le centre des notifications — le même contenu dans la feuille du téléphone
 * et dans le panneau de la tablette : l'en-tête (non lues, tout marquer lu,
 * sélection, tout supprimer), puis les notifications par jour. Toucher une
 * ligne la marque lue et ouvre SA destination (`useOpenNotification`, la même
 * que pour une push) ; `onLeave` retire la feuille juste avant.
 */
export function NotificationCenter({ unread, onLeave }: { unread: number; onLeave: () => void }) {
  const { t, i18n } = useTranslation("notifications");
  const { colors } = useTheme();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: notifications, error, refetch, isRefetching } = useNotificationsMobile();
  // Une liste qui n'a pas pu se lire n'est pas « aucune notification ».
  const failure = usePageProblem(notifications ? null : error, {
    target: "tentacle", availability: { canGoBack: false }, onRetry: () => void refetch(),
  });
  const markAll = useMarkAllReadMobile();
  const markOne = useMarkReadMobile();
  const deleteOne = useDeleteNotificationMobile();
  const deleteBatch = useDeleteNotificationsMobile();
  const deleteAll = useDeleteAllNotificationsMobile();
  const { data: plugins } = useActivePlugins();
  const pluginMeta = useMemo(() => toNotifPluginMeta(plugins ?? []), [plugins]);
  const open = useOpenNotification();

  const list = useMemo(() => notifications ?? [], [notifications]);
  const sections = useMemo(
    () => groupNotificationsByDay(list).map(({ group, items }) => ({ key: group, data: items })),
    [list],
  );

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelected(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelected((prev) => (prev.size === list.length ? new Set() : new Set(list.map((n) => n.id))));
  }, [list]);

  const handlePress = useCallback((n: AppNotification) => {
    if (!n.read) markOne.mutate(n.id);
    // Sans destination, elle se marque lue et la feuille reste (le bureau fait
    // de même). Extensions pas encore lues : on ne sait pas, l'ouverture les lira.
    const leads = notificationHasDestination(n, "mobile", pluginMeta) || n.target?.kind === "title"
      || (!plugins && notificationNeedsPlugins(n));
    if (!leads) return;
    onLeave();
    exitSelection();
    void open(n, "center");
  }, [markOne, pluginMeta, plugins, onLeave, exitSelection, open]);

  const handleDeleteAll = useCallback(() => {
    Alert.alert(t("deleteAll"), t("confirmDeleteAll"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("confirm"), style: "destructive", onPress: () => deleteAll.mutate() },
    ]);
  }, [t, deleteAll]);

  const handleDeleteSelected = useCallback(() => {
    deleteBatch.mutate([...selected], { onSettled: exitSelection });
  }, [selected, deleteBatch, exitSelection]);

  return (
    <>
      <NotifSheetHeader
        selectionMode={selectionMode}
        selectedCount={selected.size}
        unread={unread}
        total={list.length}
        onMarkAll={() => markAll.mutate()}
        onSelect={() => setSelectionMode(true)}
        onSelectAll={selectAll}
        onDeleteAll={handleDeleteAll}
        onDeleteSelected={handleDeleteSelected}
        onCancel={exitSelection}
      />
      <SectionList
        sections={sections}
        keyExtractor={(n) => n.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.text.quaternary, marginBottom: 8, marginTop: 10 }}>
            {t(section.key === "today" ? "groupToday" : "groupEarlier")}
          </Text>
        )}
        contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingTop: 4, paddingBottom: 24 }}
        ListEmptyComponent={failure.model ? (
          <ProblemState embedded model={failure.model} onAction={failure.onAction} busy={isRefetching ? "retry" : null} />
        ) : (
          <EmptyNotifications t={t} />
        )}
        renderItem={({ item: n }) => (
          <SwipeableNotifRow
            notif={n}
            formattedTitle={formatNotifTitle(n, t)}
            formattedBody={notifBodyText(n)}
            formattedAgo={formatAgo(n.createdAt, t, i18n.language)}
            hasRoute={notificationHasDestination(n, "mobile", pluginMeta)}
            onPress={() => handlePress(n)}
            onDelete={() => deleteOne.mutate(n.id)}
            selectionMode={selectionMode}
            isSelected={selected.has(n.id)}
            onToggleSelect={() => toggle(n.id)}
            onLongPress={() => { setSelectionMode(true); toggle(n.id); }}
          />
        )}
      />
    </>
  );
}

/** L'état vide du bureau : une cloche sur un aplat du dégradé de marque, deux lignes. */
function EmptyNotifications({ t }: { t: Translate }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", marginTop: 40, paddingHorizontal: 32 }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand.soft, marginBottom: 16 }}>
        <Feather name="bell" size={24} color={colors.brand.light} />
      </View>
      <Text style={{ ...typography.body, color: colors.text.primary, fontWeight: "700", textAlign: "center" }}>{t("emptyTitle")}</Text>
      <Text style={{ ...typography.caption, color: colors.text.tertiary, textAlign: "center", marginTop: 6 }}>{t("emptyHint")}</Text>
    </View>
  );
}
