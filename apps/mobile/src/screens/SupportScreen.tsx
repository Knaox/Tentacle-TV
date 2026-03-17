import { useState, useCallback, useMemo } from "react";
import { View, Text, FlatList, TextInput, ScrollView, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme";
import { GlassCard, Badge, Button, IconButton, SubtleBackground } from "../components/ui";

type ScreenView = "list" | "new" | "detail";
type Status = "open" | "in_progress" | "resolved" | "closed";
type Category = "general" | "bug" | "feature" | "account";

interface Ticket {
  id: string; subject: string; category: string; status: Status;
  createdAt: string; updatedAt: string; _count?: { messages: number };
}
interface TicketMessage {
  id: string; username: string; isAdmin: boolean; body: string; createdAt: string;
}
interface TicketDetail extends Ticket { messages: TicketMessage[] }

const STATUS_BADGE: Record<Status, { tKey: string; variant: "success" | "accent" | "gold" | "muted" }> = {
  open: { tKey: "statusOpen", variant: "success" },
  in_progress: { tKey: "statusInProgress", variant: "accent" },
  resolved: { tKey: "statusResolved", variant: "gold" },
  closed: { tKey: "statusClosed", variant: "muted" },
};
const CATEGORIES: { value: Category; tKey: string }[] = [
  { value: "general", tKey: "categoryGeneral" }, { value: "bug", tKey: "categoryBug" },
  { value: "feature", tKey: "categoryFeature" }, { value: "account", tKey: "categoryAccount" },
];
const FILTERS = [
  { key: "", tKey: "all" }, { key: "open", tKey: "open" },
  { key: "in_progress", tKey: "inProgress" }, { key: "resolved", tKey: "resolved" },
  { key: "closed", tKey: "closed" },
];

function useTicketApi() {
  const { storage } = useTentacleConfig();
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const token = storage.getItem("tentacle_token") ?? "";
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`, "Content-Type": "application/json",
  }), [token]);
  return { serverUrl, headers };
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      backgroundColor: active ? colors.accent : "rgba(255,255,255,0.06)",
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: spacing.badgeRadius,
    }}>
      <Text style={{ ...typography.caption, fontWeight: "600",
        color: active ? "#fff" : colors.textSecondary }}>{label}</Text>
    </Pressable>
  );
}

interface SupportScreenProps {
  initialTicketId?: string;
}

export function SupportScreen({ initialTicketId }: SupportScreenProps) {
  const [view, setView] = useState<ScreenView>(initialTicketId ? "detail" : "list");
  const [selectedId, setSelectedId] = useState<string | null>(initialTicketId ?? null);
  const openTicket = useCallback((id: string) => { setSelectedId(id); setView("detail"); }, []);
  const goBack = useCallback(() => setView("list"), []);

  if (view === "new") return <NewTicketView onBack={goBack} onCreated={openTicket} />;
  if (view === "detail" && selectedId) return <DetailView ticketId={selectedId} onBack={goBack} hideBack={!!initialTicketId && selectedId === initialTicketId} />;
  return <ListView onNew={() => setView("new")} onOpen={openTicket} />;
}

function ListView({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) {
  const { t } = useTranslation("tickets");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const { serverUrl, headers } = useTicketApi();
  const { data, isLoading } = useQuery({
    queryKey: ["tickets", filter],
    queryFn: async () => {
      const p = filter ? `?status=${filter}` : "";
      const res = await fetch(`${serverUrl}/api/tickets${p}`, { headers });
      if (!res.ok) throw new Error("fetch failed");
      return res.json() as Promise<{ results: Ticket[] }>;
    },
    enabled: !!serverUrl,
  });
  const tickets = data?.results ?? [];

  return (
    <SubtleBackground style={{ justifyContent: "flex-start" }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: spacing.screenPadding,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: spacing.sm }}>
            <Feather name="chevron-left" size={26} color={colors.accent} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.textPrimary }}>{t("myTickets")}</Text>
        </View>
        <Button title={t("newTicket")} onPress={onNew} style={{ paddingVertical: 10, paddingHorizontal: 16 }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginTop: spacing.md }}
        contentContainerStyle={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.screenPadding, gap: spacing.sm }}>
        {FILTERS.map((f) => <Chip key={f.key} label={t(f.tKey)} active={filter === f.key} onPress={() => setFilter(f.key)} />)}
      </ScrollView>
      {isLoading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} /> : tickets.length === 0 ? (
        <Text style={{ ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: 60 }}>
          {t("noTickets")}</Text>
      ) : (
        <FlatList data={tickets} keyExtractor={(i) => i.id} style={{ flex: 1, marginTop: spacing.md }}
          contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingBottom: insets.bottom + 100 }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => {
            const sb = STATUS_BADGE[item.status];
            const cat = CATEGORIES.find((c) => c.value === item.category);
            const catLabel = cat ? t(cat.tKey) : item.category;
            return (
              <Pressable onPress={() => onOpen(item.id)}>
                <GlassCard>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ ...typography.bodyBold, color: colors.textPrimary, flex: 1, marginRight: spacing.sm }} numberOfLines={1}>{item.subject}</Text>
                    <Badge label={t(sb.tKey)} variant={sb.variant} />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: spacing.sm }}>
                    <Badge label={catLabel} />
                    <Text style={{ ...typography.caption, color: colors.textMuted }}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
                    {item._count && <Text style={{ ...typography.caption, color: colors.textMuted }}>{t("messagesCount", { count: item._count.messages })}</Text>}
                  </View>
                </GlassCard>
              </Pressable>
            );
          }} />
      )}
    </SubtleBackground>
  );
}

function NewTicketView({ onBack, onCreated }: { onBack: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation("tickets");
  const { t: tc } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const { serverUrl, headers } = useTicketApi();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [body, setBody] = useState("");

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${serverUrl}/api/tickets`, {
        method: "POST", headers,
        body: JSON.stringify({ subject: subject.trim(), category, body: body.trim() }),
      });
      if (!res.ok) throw new Error("create failed");
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["tickets"] }); onCreated(data.id); },
  });
  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !createMut.isPending;

  return (
    <SubtleBackground>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.xxl }}>
          <IconButton icon="<" onPress={onBack} style={{ marginRight: spacing.md }} />
          <Text style={{ ...typography.title, color: colors.textPrimary }}>{t("newTicket")}</Text>
        </View>
        <Text style={labelStyle}>{t("subject")}</Text>
        <TextInput value={subject} onChangeText={setSubject} maxLength={300}
          placeholderTextColor={colors.textDim} placeholder={t("subjectPlaceholder")} style={inputStyle} />
        <Text style={[labelStyle, { marginTop: spacing.lg }]}>{t("category")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {CATEGORIES.map((c) => <Chip key={c.value} label={t(c.tKey)} active={category === c.value} onPress={() => setCategory(c.value)} />)}
        </ScrollView>
        <Text style={[labelStyle, { marginTop: spacing.lg }]}>{t("message")}</Text>
        <TextInput value={body} onChangeText={setBody} maxLength={5000} multiline numberOfLines={6} textAlignVertical="top"
          placeholderTextColor={colors.textDim} placeholder={t("messagePlaceholder")}
          style={[inputStyle, { height: 140, paddingTop: spacing.md }]} />
        <Button title={createMut.isPending ? tc("sending") : t("createTicket")}
          onPress={() => createMut.mutate()} disabled={!canSubmit} loading={createMut.isPending} fullWidth style={{ marginTop: spacing.xxl }} />
      </ScrollView>
    </KeyboardAvoidingView>
    </SubtleBackground>
  );
}

function DetailView({ ticketId, onBack, hideBack }: { ticketId: string; onBack: () => void; hideBack?: boolean }) {
  const { t } = useTranslation("tickets");
  const { t: tc } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const { serverUrl, headers } = useTicketApi();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const res = await fetch(`${serverUrl}/api/tickets/${ticketId}`, { headers });
      if (!res.ok) throw new Error("fetch failed");
      return res.json() as Promise<TicketDetail>;
    },
    enabled: !!serverUrl,
  });
  const replyMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${serverUrl}/api/tickets/${ticketId}/reply`, {
        method: "POST", headers, body: JSON.stringify({ body: reply.trim() }),
      });
      if (!res.ok) throw new Error("reply failed");
      return res.json();
    },
    onSuccess: () => { setReply(""); queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }); },
  });

  if (isLoading || !ticket) return (
    <SubtleBackground style={{ justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator color={colors.accent} />
    </SubtleBackground>
  );

  const sb = STATUS_BADGE[ticket.status];
  const isClosed = ticket.status === "closed";

  return (
    <SubtleBackground>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {!hideBack && <IconButton icon="<" onPress={onBack} style={{ marginRight: spacing.md }} />}
          <Text style={{ ...typography.subtitle, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>{ticket.subject}</Text>
          <Badge label={t(sb.tKey)} variant={sb.variant} />
        </View>
      </View>
      <FlatList data={ticket.messages} keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.lg }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item: msg }) => (
          <View style={{ backgroundColor: msg.isAdmin ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.04)",
            borderRadius: spacing.cardRadius, padding: spacing.lg,
            borderLeftWidth: msg.isAdmin ? 3 : 0, borderLeftColor: colors.accent }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs }}>
              <Text style={{ ...typography.caption, color: msg.isAdmin ? colors.accentLight : colors.textSecondary, fontWeight: "600" }}>{msg.username}</Text>
              {msg.isAdmin && <Badge label={t("adminBadge")} variant="accent" />}
              <Text style={{ ...typography.small, color: colors.textDim }}>{new Date(msg.createdAt).toLocaleString()}</Text>
            </View>
            <Text style={{ ...typography.body, color: "rgba(255,255,255,0.8)" }}>{msg.body}</Text>
          </View>
        )} />
      {!isClosed ? (
        <View style={{ paddingHorizontal: spacing.screenPadding, paddingVertical: spacing.md,
          borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
          <TextInput value={reply} onChangeText={setReply} maxLength={5000} multiline
            placeholder={t("replyPlaceholder")} placeholderTextColor={colors.textDim}
            style={[inputStyle, { flex: 1, maxHeight: 100 }]} />
          <Button title={tc("send")} onPress={() => replyMut.mutate()}
            disabled={!reply.trim() || replyMut.isPending} loading={replyMut.isPending}
            style={{ paddingVertical: 12, paddingHorizontal: 16 }} />
        </View>
      ) : (
        <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.lg }}>
          {t("ticketClosed")}</Text>
      )}
    </KeyboardAvoidingView>
    </SubtleBackground>
  );
}

const labelStyle = { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs };
const inputStyle = {
  backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.border,
  borderRadius: spacing.buttonRadius, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  color: colors.textPrimary, ...typography.body,
};
