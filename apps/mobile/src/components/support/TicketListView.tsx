import { useState } from "react";
import { View, Text, FlatList, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SubtleBackground } from "../ui";
import { BRAND, FONT_FAMILY } from "../../theme";
import { Chip } from "./Chip";
import { TicketCard } from "./TicketCard";
import { FILTERS, useTicketApi, type Ticket } from "./ticketTypes";

interface Props {
  onNew: () => void;
  onOpen: (id: string) => void;
}

export function TicketListView({ onNew, onOpen }: Props) {
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
    <SubtleBackground ambient style={{ justifyContent: "flex-start" }}>
      <View style={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: 8,
        flexDirection: "row",
        alignItems: "center",
      }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [{ marginRight: 8, padding: 4 }, pressed && { opacity: 0.7 }]}
        >
          <Feather name="chevron-left" size={26} color={BRAND.light} />
        </Pressable>
        <Text
          style={{
            fontSize: 28,
            fontFamily: FONT_FAMILY.extrabold,
            fontWeight: "800",
            letterSpacing: -0.6,
            color: "#FFFFFF",
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
        <ActivityIndicator color={BRAND.violet} style={{ marginTop: 48 }} />
      ) : tickets.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 80, paddingHorizontal: 32 }}>
          <Feather name="inbox" size={48} color={BRAND.light} style={{ opacity: 0.5 }} />
          <Text style={{
            fontSize: 15,
            fontFamily: FONT_FAMILY.medium,
            color: "rgba(255,255,255,0.55)",
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 120 }}
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
            backgroundColor: BRAND.ghost,
            borderWidth: 1,
            borderColor: "rgba(139,92,246,0.45)",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: BRAND.violet,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.55,
            shadowRadius: 22,
            elevation: 12,
          },
          pressed && { opacity: 0.88, transform: [{ scale: 0.96 }] },
        ]}
      >
        <Feather name="plus" size={26} color={BRAND.light} />
      </Pressable>
    </SubtleBackground>
  );
}
