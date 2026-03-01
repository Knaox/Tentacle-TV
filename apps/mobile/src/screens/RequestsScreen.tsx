import { useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import {
  useSeerrRequests, useSeerrRequestCount,
  useSeerrDeleteRequest, useSeerrRetryRequest,
} from "@tentacle-tv/api-client";
import { MobileRequestRow } from "../components/MobileRequestRow";

export function RequestsScreen() {
  const { t } = useTranslation("requests");
  const [filter, setFilter] = useState("");
  const [skip, setSkip] = useState(0);
  const take = 20;

  const { data: counts } = useSeerrRequestCount();
  const { data, isLoading } = useSeerrRequests(filter || undefined, take, skip);
  const deleteMut = useSeerrDeleteRequest();
  const retryMut = useSeerrRetryRequest();

  const requests = data?.results ?? [];
  const totalPages = data?.pageInfo?.pages ?? 1;
  const currentPage = Math.floor(skip / take) + 1;

  const FILTERS: { key: string; label: string }[] = [
    { key: "", label: t("requests:all") },
    { key: "pending", label: t("requests:pending") },
    { key: "approved", label: t("requests:approved") },
    { key: "available", label: t("requests:available") },
    { key: "failed", label: t("requests:failed") },
    { key: "declined", label: t("requests:declined") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0a0f" }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 }}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 12 }}>{t("requests:title")}</Text>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const count = counts?.[f.key === "" ? "total" : f.key];
            return (
              <Pressable
                key={f.key}
                onPress={() => { setFilter(f.key); setSkip(0); }}
                style={{
                  backgroundColor: filter === f.key ? "#8b5cf6" : "rgba(255,255,255,0.05)",
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                }}
              >
                <Text style={{
                  color: filter === f.key ? "#fff" : "rgba(255,255,255,0.6)",
                  fontSize: 13, fontWeight: "600",
                }}>
                  {f.label}{count != null ? ` (${count})` : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isLoading && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      )}

      {!isLoading && requests.length === 0 && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 15 }}>{t("requests:noRequests")}</Text>
        </View>
      )}

      {!isLoading && requests.length > 0 && (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}
          renderItem={({ item }) => (
            <MobileRequestRow
              req={item}
              onDelete={deleteMut.mutate}
              onRetry={retryMut.mutate}
            />
          )}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && !isLoading && (
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16, paddingVertical: 12 }}>
          <Pressable
            disabled={currentPage <= 1}
            onPress={() => setSkip((s) => s - take)}
            style={{ backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: currentPage <= 1 ? 0.3 : 1 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{t("common:previous")}</Text>
          </Pressable>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            {currentPage} / {totalPages}
          </Text>
          <Pressable
            disabled={currentPage >= totalPages}
            onPress={() => setSkip((s) => s + take)}
            style={{ backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: currentPage >= totalPages ? 0.3 : 1 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{t("common:next")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
