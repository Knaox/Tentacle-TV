import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SubtleBackground, Badge, IconButton } from "../ui";
import { BORDER, BRAND, CTA, FONT_FAMILY, RADIUS, SURFACE } from "../../theme";
import { STATUS_BADGE, useTicketApi, type TicketDetail, type TicketMessage } from "./ticketTypes";

interface Props {
  ticketId: string;
  onBack: () => void;
  hideBack?: boolean;
}

export function TicketDetailView({ ticketId, onBack, hideBack }: Props) {
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
        method: "POST",
        headers,
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (!res.ok) throw new Error("reply failed");
      return res.json();
    },
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    },
  });

  if (isLoading || !ticket) {
    return (
      <SubtleBackground ambient style={{ justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={BRAND.violet} size="large" />
      </SubtleBackground>
    );
  }

  const sb = STATUS_BADGE[ticket.status];
  const isClosed = ticket.status === "closed";

  return (
    <SubtleBackground ambient>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: BORDER.subtle,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {!hideBack && (
              <IconButton
                icon="chevron-left"
                onPress={onBack}
                size={40}
                bgColor="transparent"
                color={BRAND.light}
                accessibilityLabel="Back"
              />
            )}
            <Text
              style={{
                fontSize: 18,
                fontFamily: FONT_FAMILY.bold,
                color: "#FFFFFF",
                flex: 1,
                letterSpacing: -0.2,
              }}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {ticket.subject}
            </Text>
            <Badge label={t(sb.tKey)} variant={sb.variant} />
          </View>
        </View>

        <FlatList
          data={ticket.messages}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item: msg }) => <MessageBubble msg={msg} />}
        />

        {!isClosed ? (
          <View style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderTopColor: BORDER.subtle,
            backgroundColor: "rgba(0,0,0,0.4)",
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 8,
          }}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              maxLength={5000}
              multiline
              placeholder={t("replyPlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.3)"
              accessibilityLabel={t("replyPlaceholder")}
              style={{
                flex: 1,
                maxHeight: 120,
                minHeight: 44,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: BORDER.subtle,
                borderRadius: RADIUS.md,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: "#FFFFFF",
                fontSize: 14,
                fontFamily: FONT_FAMILY.regular,
              }}
            />
            <Pressable
              onPress={() => replyMut.mutate()}
              disabled={!reply.trim() || replyMut.isPending}
              accessibilityRole="button"
              accessibilityLabel={tc("send")}
              style={({ pressed }) => [
                {
                  width: 44,
                  height: 44,
                  borderRadius: RADIUS.md,
                  backgroundColor: CTA.primaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: BRAND.violet,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.45,
                  shadowRadius: 14,
                  elevation: 8,
                },
                (!reply.trim() || replyMut.isPending) && { opacity: 0.4, shadowOpacity: 0 },
                pressed && { opacity: 0.88 },
              ]}
            >
              {replyMut.isPending ? (
                <ActivityIndicator color={CTA.primaryFg} size="small" />
              ) : (
                <Feather name="send" size={18} color={CTA.primaryFg} />
              )}
            </Pressable>
          </View>
        ) : (
          <View style={{
            paddingHorizontal: 16,
            paddingVertical: 16,
            paddingBottom: insets.bottom + 12,
            alignItems: "center",
          }}>
            <Text style={{
              fontSize: 13,
              fontFamily: FONT_FAMILY.medium,
              color: "rgba(255,255,255,0.5)",
              textAlign: "center",
            }}>
              {t("ticketClosed")}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SubtleBackground>
  );
}

function MessageBubble({ msg }: { msg: TicketMessage }) {
  const { t } = useTranslation("tickets");
  return (
    <View
      style={{
        backgroundColor: msg.isAdmin ? BRAND.soft : SURFACE.s2,
        borderRadius: RADIUS.lg,
        padding: 14,
        borderWidth: 1,
        borderColor: msg.isAdmin ? "rgba(139,92,246,0.25)" : BORDER.subtle,
        alignSelf: msg.isAdmin ? "flex-start" : "flex-end",
        maxWidth: "88%",
      }}
      accessibilityLabel={`${msg.username}: ${msg.body}`}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Text style={{
          fontSize: 12,
          fontFamily: FONT_FAMILY.semibold,
          color: msg.isAdmin ? BRAND.light : "rgba(255,255,255,0.78)",
        }}>
          {msg.username}
        </Text>
        {msg.isAdmin && <Badge label={t("adminBadge")} variant="accent" />}
        <Text style={{
          fontSize: 10,
          fontFamily: FONT_FAMILY.regular,
          color: "rgba(255,255,255,0.4)",
          marginLeft: "auto",
        }}>
          {new Date(msg.createdAt).toLocaleString()}
        </Text>
      </View>
      <Text style={{
        fontSize: 14,
        fontFamily: FONT_FAMILY.regular,
        color: "rgba(255,255,255,0.9)",
        lineHeight: 21,
      }}>
        {msg.body}
      </Text>
    </View>
  );
}
