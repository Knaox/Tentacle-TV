import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  filterNotifications,
  groupNotificationsByPeriod,
  useDeleteAllNotifications,
  useDeleteNotification,
  useDeleteNotifications,
  useJellyfinClient,
  useMarkAllRead,
  useMarkRead,
  useNotificationOpener,
  useNotifications,
  useNotificationsLive,
  useUnreadCount,
  type AppNotification,
  type NotificationFilter,
} from "@tentacle-tv/api-client";
import { openFamilyNotification } from "../../family/familyPosterStore";
import { useNotificationPlugins } from "../../components/notifications/useNotificationPlugins";

/**
 * L'état et les gestes du centre de notifications du web étroit — le
 * `useNotificationCenter` du mobile (notifs), sur les crochets du web :
 * filtre « Tout » / « Non lues » et périodes (règles partagées
 * `filterNotifications`, `groupNotificationsByPeriod`), sélection, ouverture
 * (la destination partagée, l'affiche d'une invitation de la Famille),
 * suppressions. Fermé, le centre oublie sa sélection et revient sur « Tout ».
 */
export function useMirrorNotifCenter(open: boolean, onLeave: () => void) {
  const { t } = useTranslation("notifications");
  const navigate = useNavigate();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: unread } = useUnreadCount();
  const { data: notifications } = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();
  const deleteOne = useDeleteNotification();
  const deleteBatch = useDeleteNotifications();
  const deleteAll = useDeleteAllNotifications();
  const client = useJellyfinClient();
  useNotificationsLive({ token: client.getAccessToken() || localStorage.getItem("tentacle_token") });
  const plugins = useNotificationPlugins();

  const all = useMemo(() => notifications ?? [], [notifications]);
  const visible = useMemo(() => filterNotifications(all, filter), [all, filter]);
  const periods = useMemo(() => groupNotificationsByPeriod(visible), [visible]);

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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  // La destination exacte (cible de l'émetteur, sinon la route du type) : la règle partagée.
  const openTarget = useNotificationOpener({ platform: "web", plugins, navigate, onLeave });
  const openOne = useCallback((n: AppNotification) => {
    // « X vous invite… » : l'affiche de l'invitation, pas une page.
    if (openFamilyNotification(n)) {
      if (!n.read) markOne.mutate(n.id);
      onLeave();
      return;
    }
    openTarget(n);
  }, [markOne, onLeave, openTarget]);

  const askDeleteAll = useCallback(() => {
    if (window.confirm(t("confirmDeleteAll"))) deleteAll.mutate();
  }, [t, deleteAll]);

  return {
    unread: unread?.count ?? 0,
    total: all.length,
    visible,
    periods,
    filter,
    setFilter,
    selectionMode,
    selected,
    toggle,
    startSelection,
    selectAll,
    exitSelection,
    openOne,
    markRead: (id: string) => markOne.mutate(id),
    remove: (id: string) => deleteOne.mutate(id),
    markAll: () => markAll.mutate(),
    askDeleteAll,
    deleteSelected: () => deleteBatch.mutate([...selected], { onSettled: exitSelection }),
  };
}
