import { useState } from "react";
import { View, Text, FlatList, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { backOrHome } from "@/utils/backOrHome";
import { Feather } from "@expo/vector-icons";
import { SubtleBackground } from "../ui";
import { FONT_FAMILY, useContentPadding, useTheme, withAlpha } from "../../theme";
import { Chip } from "./Chip";
import { TicketCard } from "./TicketCard";
import { FILTERS, useTicketApi, type Ticket } from "./ticketTypes";

interface Props {
  onNew: () => void;
  onOpen: (id: string) => void;
}

export function TicketListView({ onNew, onOpen }: Props) {
  const { t } = useTranslation("tickets");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const contentPad = useContentPadding(720);
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
    <SubtleBackground ambient style={{ justifyContent: "flex-start" }}>
      <View style={{
        paddingTop: Math.max(insets.top, 24) + 12,
        paddingHorizontal: contentPad,
        paddingBottom: 8,
        flexDirection: "row",
        alignItems: "center",
      }}>
        <Pressable
          onPress={() => backOrHome(router)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("common:back")}
          style={({ pressed }) => [{ marginRight: 8, padding: 4 }, pressed && { opacity: 0.7 }]}
        >
          <Feather name="chevron-left" size={26} color={colors.brand.light} />
        </Pressable>
        <Text
          style={{
            fontSize: 28,
            fontFamily: FONT_FAMILY.extrabold,
            fontWeight: "800",
            letterSpacing: -0.6,
            color: colors.text.primary,
            flex: 1,
          }}
          accessibilityRole="header"
        >
          {t("myTickets")}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginTop: 8 }}
        contentContainerStyle={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <Chip key={f.key} label={t(f.tKey)} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator color={colors.brand.violet} style={{ marginTop: 48 }} />
      ) : tickets.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 80, paddingHorizontal: 32 }}>
          <Feather name="inbox" size={48} color={colors.brand.light} style={{ opacity: 0.5 }} />
          <Text style={{
            fontSize: 15,
            fontFamily: FONT_FAMILY.medium,
            color: colors.text.tertiary,
            textAlign: "center",
            marginTop: 16,
          }}>
            {t("noTickets")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(i) => i.id}
          style={{ flex: 1, marginTop: 12 }}
          contentContainerStyle={{ paddingHorizontal: contentPad, paddingBottom: insets.bottom + 120 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => <TicketCard ticket={item} onOpen={onOpen} />}
        />
      )}

      {/* FAB ghost violet */}
      <Pressable
        onPress={onNew}
        accessibilityRole="button"
        accessibilityLabel={t("newTicket")}
        style={({ pressed }) => [
          {
            position: "absolute",
            right: 20,
            bottom: insets.bottom + 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.brand.ghost,
            borderWidth: 1,
            borderColor: withAlpha(colors.brand.violet, 0.45, colors.brand.glow),
            alignItems: "center",
            justifyContent: "center",
            shadowColor: colors.brand.violet,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.55,
            shadowRadius: 22,
            elevation: 12,
          },
          pressed && { opacity: 0.88, transform: [{ scale: 0.96 }] },
        ]}
      >
        <Feather name="plus" size={26} color={colors.brand.light} />
      </Pressable>
    </SubtleBackground>
  );
}
