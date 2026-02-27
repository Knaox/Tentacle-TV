import { useState, useEffect } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSearchItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MobileMediaCard } from "../components/MobileMediaCard";

export function SearchScreen() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isLoading } = useSearchItems(debounced);

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0a0f" }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher dans la bibliothèque..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "#1e1e2e",
            borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 16,
          }}
        />
      </View>

      {isLoading && debounced.length >= 2 && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      )}

      {!isLoading && debounced.length >= 2 && (!results || results.length === 0) && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 15 }}>Aucun résultat</Text>
        </View>
      )}

      {results && results.length > 0 && (
        <FlatList
          data={results}
          numColumns={3}
          keyExtractor={(item) => item.Id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
          columnWrapperStyle={{ gap: 8, marginBottom: 8 }}
          renderItem={({ item }) => (
            <View style={{ flex: 1, maxWidth: "33.33%" }}>
              <MobileMediaCard item={item} onPress={() => router.push(`/media/${item.Id}`)} />
            </View>
          )}
        />
      )}

      {debounced.length < 2 && !isLoading && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 15 }}>
            Tapez au moins 2 caractères
          </Text>
        </View>
      )}
    </View>
  );
}
