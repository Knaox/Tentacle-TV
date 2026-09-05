import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FONT_FAMILY, RADIUS, useTheme } from "../../theme";
import { useTicketApi } from "./ticketTypes";

/**
 * L'auteur ferme son ticket en disant pourquoi : le bouton déplie un champ
 * (motif OBLIGATOIRE), la confirmation envoie. Le motif part dans le fil et
 * les admins en sont prévenus.
 */
export function TicketCloseButton({ ticketId }: { ticketId: string }) {
  const { t } = useTranslation("tickets");
  const { t: tc } = useTranslation("common");
  const { colors } = useTheme();
  const { serverUrl, headers } = useTicketApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${serverUrl}/api/tickets/${ticketId}/close`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) throw new Error("close failed");
      return res.json();
    },
    onSuccess: () => {
      setOpen(false);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: () => Alert.alert(t("closeTicket"), t("closeFailed")),
  });

  const labelStyle = { fontSize: 13, fontFamily: FONT_FAMILY.semibold } as const;

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("closeTicket")}
        style={({ pressed }) => [{ alignSelf: "center", paddingVertical: 10, paddingHorizontal: 16 }, pressed && { opacity: 0.7 }]}
      >
        <Text style={{ ...labelStyle, color: colors.text.tertiary }}>{t("closeTicket")}</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.border.subtle }}>
      <Text style={{ ...labelStyle, color: colors.text.primary }}>{t("closeReasonLabel")}</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={2000}
        autoFocus
        placeholder={t("closeReasonPlaceholder")}
        placeholderTextColor={colors.text.quaternary}
        accessibilityLabel={t("closeReasonLabel")}
        style={{
          minHeight: 72, backgroundColor: colors.fill.subtle, borderWidth: 1, borderColor: colors.border.subtle,
          borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10, color: colors.text.primary,
          fontSize: 14, fontFamily: FONT_FAMILY.regular, textAlignVertical: "top",
        }}
      />
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
        <Pressable
          onPress={() => { setOpen(false); setReason(""); }}
          accessibilityRole="button"
          style={({ pressed }) => [{ minHeight: 44, paddingHorizontal: 16, justifyContent: "center", borderRadius: RADIUS.md, backgroundColor: colors.fill.subtle }, pressed && { opacity: 0.8 }]}
        >
          <Text style={{ ...labelStyle, color: colors.text.secondary }}>{tc("cancel")}</Text>
        </Pressable>
        <Pressable
          onPress={() => mutation.mutate()}
          disabled={!reason.trim() || mutation.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [
            { minHeight: 44, paddingHorizontal: 16, justifyContent: "center", borderRadius: RADIUS.md, backgroundColor: colors.status.error },
            (!reason.trim() || mutation.isPending) && { opacity: 0.4 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ ...labelStyle, color: colors.cta.brandFg }}>{t("closeConfirm")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
