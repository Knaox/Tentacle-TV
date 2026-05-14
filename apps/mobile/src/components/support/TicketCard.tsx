import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { Badge } from "../ui";
import { BORDER, FONT_FAMILY, RADIUS, SURFACE } from "../../theme";
import { CATEGORIES, STATUS_BADGE, type Ticket } from "./ticketTypes";

interface Props {
  ticket: Ticket;
  onOpen: (id: string) => void;
}

/** Ligne ticket — surface s1 + border subtle, status badge, meta date. */
export function TicketCard({ ticket, onOpen }: Props) {
  const { t } = useTranslation("tickets");
  const sb = STATUS_BADGE[ticket.status];
  const cat = CATEGORIES.find((c) => c.value === ticket.category);
  const catLabel = cat ? t(cat.tKey) : ticket.category;

  return (
    <Pressable
      onPress={() => onOpen(ticket.id)}
      accessibilityRole="button"
      accessibilityLabel={ticket.subject}
      style={({ pressed }) => [
        {
          backgroundColor: SURFACE.s1,
          borderWidth: 1,
          borderColor: BORDER.subtle,
          borderRadius: RADIUS.lg,
          padding: 16,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text
          style={{
            fontSize: 15,
            fontFamily: FONT_FAMILY.semibold,
            color: "#FFFFFF",
            flex: 1,
            letterSpacing: -0.1,
          }}
          numberOfLines={1}
        >
          {ticket.subject}
        </Text>
        <Badge label={t(sb.tKey)} variant={sb.variant} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 10, flexWrap: "wrap" }}>
        <Badge label={catLabel} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Feather name="clock" size={11} color="rgba(255,255,255,0.4)" />
          <Text style={{
            fontSize: 12,
            fontFamily: FONT_FAMILY.regular,
            color: "rgba(255,255,255,0.5)",
          }}>
            {new Date(ticket.updatedAt).toLocaleDateString()}
          </Text>
        </View>
        {ticket._count && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name="message-circle" size={11} color="rgba(255,255,255,0.4)" />
            <Text style={{
              fontSize: 12,
              fontFamily: FONT_FAMILY.regular,
              color: "rgba(255,255,255,0.5)",
            }}>
              {t("messagesCount", { count: ticket._count.messages })}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
