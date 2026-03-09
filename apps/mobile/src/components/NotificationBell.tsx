import { useState, useCallback } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { AppNotification } from "@tentacle-tv/api-client";
import {
  useNotificationsMobile,
  useUnreadCountMobile,
  useMarkAllReadMobile,
  useMarkReadMobile,
} from "@/hooks/useNotificationsMobile";
import { BottomSheet } from "./ui";
import { colors, spacing, typography } from "@/theme";

let Haptics: { impactAsync: (style: any) => void; ImpactFeedbackStyle: any } | null = null;
try { Haptics = require("expo-haptics"); } catch {}

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

const STATUS_TKEYS: Record<string, string> = {
  open: "tickets:statusOpen",
  in_progress: "tickets:statusInProgress",
  resolved: "tickets:statusResolved",
  closed: "tickets:statusClosed",
};

const FR_STATUS_TO_KEY: Record<string, string> = {
  "Ouvert": "open", "En cours": "in_progress", "Résolu": "resolved", "Fermé": "closed",
};

function formatNotifTitle(
  n: AppNotification,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (n.type === "ticket_reply") {
    // Old format: 'Réponse sur "Subject"' → extract subject
    const legacy = n.title.match(/^Réponse sur\s+"(.+)"$/);
    const subject = legacy ? legacy[1] : n.title;
    return t("ticketReplyTitle", { subject });
  }
  if (n.type === "ticket_status") {
    // New format: body = status key (open/resolved/…)
    const isNew = n.body && STATUS_TKEYS[n.body];
    if (isNew) {
      return t("ticketStatusTitle", { subject: n.title, status: t(STATUS_TKEYS[n.body!]) });
    }
    // Old format: 'Ticket "Subject" — Résolu' → extract & translate
    const legacy = n.title.match(/^Ticket\s+"(.+?)"\s+—\s+(.+)$/);
    if (legacy) {
      const statusKey = FR_STATUS_TO_KEY[legacy[2]];
      if (statusKey) {
        return t("ticketStatusTitle", { subject: legacy[1], status: t(STATUS_TKEYS[statusKey]) });
      }
    }
  }
  return n.title;
}

export function NotificationBell() {
  const { t } = useTranslation("notifications");
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const { data: unread } = useUnreadCountMobile();
  const { data: notifications } = useNotificationsMobile();
  const markAll = useMarkAllReadMobile();
  const markOne = useMarkReadMobile();

  const count = unread?.count ?? 0;

  const openSheet = useCallback(() => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVisible(true);
  }, []);

  const handleNotifPress = useCallback((n: AppNotification) => {
    setVisible(false);
    if (!n.read) markOne.mutate(n.id);
    if (n.type === "ticket_reply" || n.type === "ticket_status") {
      router.push(`/support?ticketId=${n.refId}`);
    } else if (n.type === "request_status") {
      router.push("/(tabs)/plugins");
    }
  }, [markOne, router]);

  return (
    <>
      <Pressable onPress={openSheet} hitSlop={8} style={{ position: "relative" }} accessibilityRole="button" accessibilityLabel={count > 0 ? t("title") + `, ${count}` : t("title")}>
        <Feather name="bell" size={20} color="#ffffff" />
        {count > 0 && (
          <View style={{
            position: "absolute", top: -4, right: -6,
            minWidth: 16, height: 16, borderRadius: 8,
            backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
            paddingHorizontal: 4,
          }}>
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
              {count > 9 ? "9+" : count}
            </Text>
          </View>
        )}
      </Pressable>

      <BottomSheet visible={visible} onClose={() => setVisible(false)} snapPoints={[0.5, 1.0]}>
        {/* Header */}
        <View style={{
          flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          paddingHorizontal: spacing.screenPadding, paddingTop: 8, paddingBottom: 12,
          borderBottomWidth: 1, borderBottomColor: colors.border,
        }}>
          <Text style={{ ...typography.subtitle, color: colors.textPrimary }}>{t("title")}</Text>
          {count > 0 && (
            <Pressable onPress={() => markAll.mutate()} hitSlop={8}>
              <Text style={{ ...typography.small, color: colors.accent }}>{t("markAllRead")}</Text>
            </Pressable>
          )}
        </View>

        <FlatList
          data={notifications ?? []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingTop: 12 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 48 }}>
              <Feather name="bell-off" size={40} color={colors.textDim} />
              <Text style={{ ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: 16 }}>
                {t("noNotifications")}
              </Text>
            </View>
          }
          renderItem={({ item: n }) => (
            <Pressable
              onPress={() => handleNotifPress(n)}
              style={({ pressed }) => ({
                backgroundColor: "#1a1a2e",
                borderRadius: 12, padding: 16, marginBottom: 8,
                flexDirection: "row", gap: 10,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {!n.read && (
                <View style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: colors.accent, marginTop: 6,
                }} />
              )}
              <View style={{ flex: 1, marginLeft: n.read ? 18 : 0 }}>
                <Text
                  style={{
                    ...typography.small,
                    fontWeight: n.read ? "400" : "700",
                    color: n.read ? colors.textMuted : colors.textPrimary,
                  }}
                  numberOfLines={1}
                >
                  {formatNotifTitle(n, t)}
                </Text>
                {n.body && n.type !== "ticket_status" && (
                  <Text style={{ ...typography.badge, color: colors.textMuted, marginTop: 4 }} numberOfLines={2}>
                    {n.body}
                  </Text>
                )}
                <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
                  {formatAgo(n.createdAt, t)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </BottomSheet>
    </>
  );
}
