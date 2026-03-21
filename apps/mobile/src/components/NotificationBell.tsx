import { useState, useCallback, useMemo } from "react";
import { View, Text, Pressable, FlatList, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { AppNotification } from "@tentacle-tv/api-client";
import { resolveNotificationRoute } from "@tentacle-tv/api-client";
import {
  useNotificationsMobile,
  useUnreadCountMobile,
  useMarkAllReadMobile,
  useMarkReadMobile,
  useDeleteNotificationMobile,
  useDeleteNotificationsMobile,
  useDeleteAllNotificationsMobile,
} from "@/hooks/useNotificationsMobile";
import { useActivePlugins } from "@/hooks/useActivePlugins";
import { BottomSheet } from "./ui";
import { SwipeableNotifRow } from "./notifications/SwipeableNotifRow";
import { colors, spacing, typography } from "@/theme";

let Haptics: { impactAsync: (style: unknown) => void; ImpactFeedbackStyle: Record<string, unknown> } | null = null;
try { Haptics = require("expo-haptics"); } catch {}

// ── Helpers ──

const STATUS_TKEYS: Record<string, string> = {
  open: "tickets:statusOpen", in_progress: "tickets:statusInProgress",
  resolved: "tickets:statusResolved", closed: "tickets:statusClosed",
};
const FR_STATUS_TO_KEY: Record<string, string> = {
  "Ouvert": "open", "En cours": "in_progress", "Résolu": "resolved", "Fermé": "closed",
};

function formatNotifTitle(n: AppNotification, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (n.type === "ticket_reply") {
    const legacy = n.title.match(/^Réponse sur\s+"(.+)"$/);
    return t("ticketReplyTitle", { subject: legacy ? legacy[1] : n.title });
  }
  if (n.type === "ticket_status") {
    const isNew = n.body && STATUS_TKEYS[n.body];
    if (isNew) return t("ticketStatusTitle", { subject: n.title, status: t(STATUS_TKEYS[n.body!]) });
    const legacy = n.title.match(/^Ticket\s+"(.+?)"\s+—\s+(.+)$/);
    if (legacy) {
      const sk = FR_STATUS_TO_KEY[legacy[2]];
      if (sk) return t("ticketStatusTitle", { subject: legacy[1], status: t(STATUS_TKEYS[sk]) });
    }
  }
  return n.title;
}

function formatAgo(dateStr: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return t("minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("daysAgo", { count: days });
}

// ── Component ──

export function NotificationBell() {
  const { t } = useTranslation("notifications");
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: unread } = useUnreadCountMobile();
  const { data: notifications } = useNotificationsMobile();
  const markAll = useMarkAllReadMobile();
  const markOne = useMarkReadMobile();
  const deleteOne = useDeleteNotificationMobile();
  const deleteBatch = useDeleteNotificationsMobile();
  const deleteAll = useDeleteAllNotificationsMobile();
  const { data: plugins } = useActivePlugins();

  const pluginNavMeta = useMemo(
    () => (plugins ?? []).map((p: { pluginId: string; navItems?: Array<{ path: string; platforms: string[] }> }) => ({
      pluginId: p.pluginId,
      navItems: p.navItems ?? [],
    })),
    [plugins],
  );

  const count = unread?.count ?? 0;

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

  const openSheet = useCallback(() => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVisible(true);
  }, []);

  const handleNotifPress = useCallback((n: AppNotification) => {
    setVisible(false);
    exitSelection();
    if (!n.read) markOne.mutate(n.id);
    const route = resolveNotificationRoute(n, "mobile", pluginNavMeta);
    if (route) router.push(route as never);
  }, [markOne, router, pluginNavMeta, exitSelection]);

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
      <Pressable onPress={openSheet} hitSlop={8} style={{ position: "relative" }} accessibilityRole="button" accessibilityLabel={count > 0 ? `${t("title")}, ${count}` : t("title")}>
        <Feather name="bell" size={20} color="#ffffff" />
        {count > 0 && (
          <View style={{ position: "absolute", top: -4, right: -6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{count > 9 ? "9+" : count}</Text>
          </View>
        )}
      </Pressable>

      <BottomSheet visible={visible} onClose={() => { setVisible(false); exitSelection(); }} snapPoints={[0.5, 1.0]}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.screenPadding, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ ...typography.subtitle, color: colors.textPrimary }}>
            {selectionMode ? t("selected", { count: selected.size }) : t("title")}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {selectionMode ? (
              <>
                <Pressable onPress={handleDeleteSelected} disabled={selected.size === 0} hitSlop={8}>
                  <Text style={{ ...typography.small, color: selected.size > 0 ? colors.danger : colors.textDim }}>{t("deleteSelected")}</Text>
                </Pressable>
                <Pressable onPress={exitSelection} hitSlop={8}>
                  <Text style={{ ...typography.small, color: colors.textSecondary }}>{t("cancel")}</Text>
                </Pressable>
              </>
            ) : (
              <>
                {count > 0 && (
                  <Pressable onPress={() => markAll.mutate()} hitSlop={8}>
                    <Text style={{ ...typography.small, color: colors.accent }}>{t("markAllRead")}</Text>
                  </Pressable>
                )}
                {notifications && notifications.length > 0 && (
                  <Pressable onPress={handleDeleteAll} hitSlop={8}>
                    <Text style={{ ...typography.small, color: colors.danger }}>{t("deleteAll")}</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>

        <FlatList
          data={notifications ?? []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingTop: 12 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 48 }}>
              <Feather name="bell-off" size={40} color={colors.textDim} />
              <Text style={{ ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: 16 }}>{t("noNotifications")}</Text>
            </View>
          }
          renderItem={({ item: n }) => (
            <SwipeableNotifRow
              notif={n}
              formattedTitle={formatNotifTitle(n, t)}
              formattedAgo={formatAgo(n.createdAt, t)}
              onPress={() => handleNotifPress(n)}
              onDelete={() => deleteOne.mutate(n.id)}
              selectionMode={selectionMode}
              isSelected={selected.has(n.id)}
              onToggleSelect={() => toggle(n.id)}
              onLongPress={() => { setSelectionMode(true); toggle(n.id); }}
            />
          )}
        />
      </BottomSheet>
    </>
  );
}
