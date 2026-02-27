import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList } from "react-native";
import { useSearchItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVSearchKeyboard } from "../components/TVSearchKeyboard";
import { TVMediaCard } from "../components/TVMediaCard";
import { Focusable } from "../components/focus/Focusable";
import { SkeletonCardPortrait } from "../components/SkeletonLoader";
import { useTVRemote } from "../components/focus/useTVRemote";
import { Colors, Spacing, Typography, Radius, CardConfig } from "../theme/colors";

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

  const navigateToDetail = useCallback((item: MediaItem) => {
    navigation.navigate("MediaDetail", { itemId: item.Id });
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep, paddingTop: 32 }}>
      {/* Back button */}
      <View style={{ paddingHorizontal: Spacing.screenPadding, marginBottom: 16 }}>
        <Focusable onPress={() => navigation.goBack()} hasTVPreferredFocus style={{ alignSelf: "flex-start" }}>
          <View style={{
            paddingHorizontal: 16, paddingVertical: 8,
            borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1, borderColor: Colors.glassBorder,
          }}>
            <Text style={{ color: Colors.accentPurpleLight, fontSize: 14, fontWeight: "600" }}>
              {t("common:back")}
            </Text>
          </View>
        </Focusable>
      </View>

      {/* Main content: keyboard left + results right */}
      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* Left side: title + keyboard */}
        <View style={{ paddingLeft: Spacing.screenPadding, paddingTop: 8 }}>
          <Text style={{
            color: Colors.textPrimary,
            ...Typography.sectionTitle,
            marginBottom: 16,
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
              paddingHorizontal: 32, paddingVertical: 24, gap: Spacing.cardGap,
            }}>
              {Array.from({ length: 8 }).map((_, i) => (
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
            <FlatList
              data={results}
              numColumns={4}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 32, paddingVertical: 24 }}
              keyExtractor={(item) => item.Id}
              columnWrapperStyle={{ gap: Spacing.cardGap, marginBottom: Spacing.cardGap }}
              renderItem={({ item }) => (
                <Focusable onPress={() => navigateToDetail(item)} noBorder>
                  <TVMediaCard item={item} variant="portrait" />
                </Focusable>
              )}
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
    </View>
  );
}
