import { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { useSearchItems } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVSearchKeyboard } from "../components/TVSearchKeyboard";
import { FocusableGrid } from "../components/focus/FocusableGrid";
import { TVMediaCard } from "../components/TVMediaCard";
import { useTVRemote } from "../components/focus/useTVRemote";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

export function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isLoading } = useSearchItems(debounced);

  useTVRemote({ onBack: () => navigation.goBack() });

  const handleKeyPress = (key: string) => setQuery((q) => q + key);
  const handleDelete = () => setQuery((q) => q.slice(0, -1));
  const handleClear = () => setQuery("");

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#0a0a0f", paddingTop: 48 }}>
      {/* Left side: keyboard */}
      <View style={{ paddingLeft: 48, paddingTop: 16 }}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 20 }}>Rechercher</Text>
        <TVSearchKeyboard query={query} onKeyPress={handleKeyPress} onDelete={handleDelete} onClear={handleClear} />
      </View>

      {/* Right side: results */}
      <View style={{ flex: 1 }}>
        {isLoading && debounced.length >= 2 && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }}>Recherche en cours...</Text>
          </View>
        )}

        {!isLoading && debounced.length >= 2 && (!results || results.length === 0) && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }}>Aucun résultat</Text>
          </View>
        )}

        {results && results.length > 0 && (
          <FocusableGrid
            data={results}
            numColumns={5}
            keyExtractor={(item: MediaItem) => item.Id}
            renderItem={(item: MediaItem) => <TVMediaCard item={item} width={160} />}
            onItemPress={(item: MediaItem) => navigation.navigate("MediaDetail", { itemId: item.Id })}
          />
        )}

        {debounced.length < 2 && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 16 }}>
              Tapez au moins 2 caractères pour rechercher
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
