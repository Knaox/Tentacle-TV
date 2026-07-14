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
import { FONT_FAMILY, RADIUS, useContentPadding, useTheme, withAlpha } from "../../theme";
import { STATUS_BADGE, useTicketApi, type TicketDetail, type TicketMessage } from "./ticketTypes";

interface Props {
  ticketId: string;
  onBack: () => void;
  hideBack?: boolean;
}

export function TicketDetailView({ ticketId, onBack, hideBack }: Props) {
  const { t } = useTranslation("tickets");
  const { t: tc } = useTranslation("common");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const contentPad = useContentPadding(720);
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
        <ActivityIndicator color={colors.brand.violet} size="large" />
      </SubtleBackground>
    );
  }

  const sb = STATUS_BADGE[ticket.status];
  const isClosed = ticket.status === "closed";

  return (
    <SubtleBackground ambient>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{
          paddingTop: Math.max(insets.top, 24) + 12,
          paddingHorizontal: contentPad,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.subtle,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {!hideBack && (
              <IconButton
                icon="chevron-left"
                onPress={onBack}
                size={40}
                bgColor="transparent"
                color={colors.brand.light}
                accessibilityLabel={tc("back")}
              />
            )}
            <Text
              style={{
                fontSize: 18,
                fontFamily: FONT_FAMILY.bold,
                color: colors.text.primary,
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
            paddingHorizontal: contentPad,
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
            borderTopColor: colors.border.subtle,
            backgroundColor: colors.overlay.scrimSoft,
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
              placeholderTextColor={colors.text.quaternary}
              accessibilityLabel={t("replyPlaceholder")}
              style={{
                flex: 1,
                maxHeight: 120,
                minHeight: 44,
                backgroundColor: colors.fill.subtle,
                borderWidth: 1,
                borderColor: colors.border.subtle,
                borderRadius: RADIUS.md,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: colors.text.primary,
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
                  backgroundColor: colors.cta.primaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: colors.brand.violet,
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
                <ActivityIndicator color={colors.cta.primaryFg} size="small" />
              ) : (
                <Feather name="send" size={18} color={colors.cta.primaryFg} />
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
              color: colors.text.tertiary,
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
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: msg.isAdmin ? colors.brand.soft : colors.surface.s2,
        borderRadius: RADIUS.lg,
        padding: 14,
        borderWidth: 1,
        borderColor: msg.isAdmin ? withAlpha(colors.brand.violet, 0.25, colors.brand.glow) : colors.border.subtle,
        alignSelf: msg.isAdmin ? "flex-start" : "flex-end",
        maxWidth: "88%",
      }}
      accessibilityLabel={`${msg.username}: ${msg.body}`}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Text style={{
          fontSize: 12,
          fontFamily: FONT_FAMILY.semibold,
          color: msg.isAdmin ? colors.brand.light : colors.text.secondary,
        }}>
          {msg.username}
        </Text>
        {msg.isAdmin && <Badge label={t("adminBadge")} variant="accent" />}
        <Text style={{
          fontSize: 10,
          fontFamily: FONT_FAMILY.regular,
          color: colors.text.quaternary,
          marginLeft: "auto",
        }}>
          {new Date(msg.createdAt).toLocaleString()}
        </Text>
      </View>
      <Text style={{
        fontSize: 14,
        fontFamily: FONT_FAMILY.regular,
        color: withAlpha(colors.text.primary, 0.9, colors.text.secondary),
        lineHeight: 21,
      }}>
        {msg.body}
      </Text>
    </View>
  );
}
