import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionSheetIOS, Alert, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import {
  filterNotifications,
  groupNotificationsByPeriod,
  notificationHasDestination,
  notificationNeedsPlugins,
  type AppNotification,
  type NotificationFilter,
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
import { useOpenNotification } from "@/notifications/useOpenNotification";

/**
 * L'état et les gestes du centre, à part de son rendu : filtre, sélection,
 * ouverture (la même que pour une push), suppressions, menu. Fermé
 * (`open` faux), le centre oublie sa sélection et revient sur « Tout ».
 */
export function useNotificationCenter({ open, onLeave }: { open: boolean; onLeave: () => void }) {
  const { t } = useTranslation("notifications");
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const query = useNotificationsMobile();
  const markAll = useMarkAllReadMobile();
  const markOne = useMarkReadMobile();
  const deleteOne = useDeleteNotificationMobile();
  const deleteBatch = useDeleteNotificationsMobile();
  const deleteAll = useDeleteAllNotificationsMobile();
  const { data: plugins } = useActivePlugins();
  const pluginMeta = useMemo(() => toNotifPluginMeta(plugins ?? []), [plugins]);
  const openNotification = useOpenNotification();

  const all = useMemo(() => query.data ?? [], [query.data]);
  const visible = useMemo(() => filterNotifications(all, filter), [all, filter]);
  const sections = useMemo(
    () => groupNotificationsByPeriod(visible).map(({ group, items }) => ({ key: group, data: items })),
    [visible],
  );

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelected(new Set());
  }, []);

  useEffect(() => {
    if (open) return;
    exitSelection();
    setFilter("all");
  }, [open, exitSelection]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const startSelection = useCallback((id?: string) => {
    setSelectionMode(true);
    if (id) toggle(id);
  }, [toggle]);

  const selectAll = useCallback(() => {
    setSelected((prev) => (prev.size === visible.length ? new Set() : new Set(visible.map((n) => n.id))));
  }, [visible]);

  const hasRoute = useCallback((n: AppNotification) => notificationHasDestination(n, "mobile", pluginMeta), [pluginMeta]);

  const openOne = useCallback((n: AppNotification) => {
    if (!n.read) markOne.mutate(n.id);
    // Sans destination, elle se marque lue et le centre reste (comme le bureau).
    // Extensions pas encore lues : on ne sait pas, l'ouverture les lira.
    const leads = hasRoute(n) || n.target?.kind === "title" || (!plugins && notificationNeedsPlugins(n));
    if (!leads) return;
    onLeave();
    void openNotification(n, "center");
  }, [markOne, hasRoute, plugins, onLeave, openNotification]);

  const markRead = useCallback((id: string) => markOne.mutate(id), [markOne]);
  const remove = useCallback((id: string) => deleteOne.mutate(id), [deleteOne]);

  const deleteSelected = useCallback(() => {
    deleteBatch.mutate([...selected], { onSettled: exitSelection });
  }, [selected, deleteBatch, exitSelection]);

  const askDeleteAll = useCallback(() => {
    Alert.alert(t("deleteAll"), t("confirmDeleteAll"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("confirm"), style: "destructive", onPress: () => deleteAll.mutate() },
    ]);
  }, [t, deleteAll]);

  /** Le menu « … » : sélectionner, tout supprimer — feuille d'actions d'iOS, alerte sur Android. */
  const openMenu = useCallback(() => {
    const options = [t("select"), t("deleteAll"), t("cancel")];
    const run = (index: number) => {
      if (index === 0) startSelection();
      if (index === 1) askDeleteAll();
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, destructiveButtonIndex: 1, cancelButtonIndex: 2 }, run);
      return;
    }
    Alert.alert(t("moreActions"), undefined, [
      { text: options[0], onPress: () => run(0) },
      { text: options[1], style: "destructive", onPress: () => run(1) },
      { text: options[2], style: "cancel" },
    ]);
  }, [t, startSelection, askDeleteAll]);

  return {
    query, all, visible, sections, filter, setFilter,
    selectionMode, selected, toggle, startSelection, selectAll, exitSelection, deleteSelected,
    hasRoute, openOne, markRead, remove, markAll: () => markAll.mutate(), openMenu,
  };
}
