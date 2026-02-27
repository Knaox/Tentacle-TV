import { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { useSearchItems } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVSearchKeyboard } from "../components/TVSearchKeyboard";
import { FocusableGrid } from "../components/focus/FocusableGrid";
import { TVMediaCard } from "../components/TVMediaCard";
import { SkeletonCardPortrait } from "../components/SkeletonLoader";
import { useTVRemote } from "../components/focus/useTVRemote";
import { Colors, Spacing, Typography, Radius } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

export function SearchScreen({ navigation }: Props) {
  const { t } = useTranslation(["common", "nav"]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useSearchItems(debounced);

  useTVRemote({ onBack: () => navigation.goBack() });

  const handleKeyPress = (key: string) => setQuery((q) => q + key);
  const handleDelete = () => setQuery((q) => q.slice(0, -1));
  const handleClear = () => setQuery("");

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: Colors.bgDeep, paddingTop: 48 }}>
      {/* Left side: keyboard */}
      <View style={{ paddingLeft: Spacing.screenPadding, paddingTop: 16 }}>
        <Text style={{
          color: Colors.textPrimary,
          ...Typography.sectionTitle,
          marginBottom: 24,
        }}>
          {t("nav:search")}
        </Text>
        <TVSearchKeyboard
          query={query}
          onKeyPress={handleKeyPress}
          onDelete={handleDelete}
          onClear={handleClear}
        />
      </View>

      {/* Right side: results */}
      <View style={{ flex: 1 }}>
        {/* Loading skeleton */}
        {isLoading && debounced.length >= 2 && (
          <View style={{
            flexDirection: "row", flexWrap: "wrap",
            paddingHorizontal: 48, paddingVertical: 24, gap: Spacing.cardGap,
          }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonCardPortrait key={i} />
            ))}
          </View>
        )}

        {/* No results */}
        {!isLoading && debounced.length >= 2 && (!results || results.length === 0) && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: Colors.textTertiary, ...Typography.body }}>
              {t("common:noResults")}
            </Text>
          </View>
        )}

        {/* Results grid */}
        {results && results.length > 0 && (
          <FocusableGrid
            data={results}
            numColumns={5}
            gap={Spacing.cardGap}
            keyExtractor={(item: MediaItem) => item.Id}
            renderItem={(item: MediaItem) => <TVMediaCard item={item} width={180} />}
            onItemPress={(item: MediaItem) => navigation.navigate("MediaDetail", { itemId: item.Id })}
          />
        )}

        {/* Prompt to type */}
        {debounced.length < 2 && !isLoading && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: Colors.textTertiary, ...Typography.body }}>
              {t("common:typeMinChars")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
