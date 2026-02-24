import { useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSeerrDiscover, useSeerrRequest } from "@tentacle/api-client";
import { MobileSeerrCard } from "../components/MobileSeerrCard";

type Category = "movies" | "tv" | "anime";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "movies", label: "Films" },
  { key: "tv", label: "Séries" },
  { key: "anime", label: "Animés" },
];

export function DiscoverScreen() {
  const [category, setCategory] = useState<Category>("movies");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSeerrDiscover(category, page);
  const requestMutation = useSeerrRequest();

  const results = (data?.results ?? []).filter((r) => r.mediaType === "movie" || r.mediaType === "tv");
  const totalPages = data?.totalPages ?? 1;

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0a0f" }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 }}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 12 }}>Découvrir</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              onPress={() => { setCategory(cat.key); setPage(1); }}
              style={{
                backgroundColor: category === cat.key ? "#8b5cf6" : "rgba(255,255,255,0.05)",
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
              }}
            >
              <Text style={{
                color: category === cat.key ? "#fff" : "rgba(255,255,255,0.6)",
                fontSize: 14, fontWeight: "600",
              }}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      )}

      {!isLoading && results.length === 0 && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 15 }}>Aucun contenu à découvrir</Text>
        </View>
      )}

      {!isLoading && results.length > 0 && (
        <FlatList
          data={results}
          numColumns={3}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
          columnWrapperStyle={{ gap: 8, marginBottom: 8 }}
          renderItem={({ item }) => (
            <View style={{ flex: 1, maxWidth: "33.33%" }}>
              <MobileSeerrCard item={item} onRequest={requestMutation.mutate} />
            </View>
          )}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && !isLoading && (
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16, paddingVertical: 12 }}>
          <Pressable
            disabled={page <= 1}
            onPress={() => setPage((p) => p - 1)}
            style={{ backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: page <= 1 ? 0.3 : 1 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Précédent</Text>
          </Pressable>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            {page} / {totalPages}
          </Text>
          <Pressable
            disabled={page >= totalPages}
            onPress={() => setPage((p) => p + 1)}
            style={{ backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: page >= totalPages ? 0.3 : 1 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Suivant</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
