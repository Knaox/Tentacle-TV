import { useState, useEffect, useCallback, useRef } from "react";
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

const NUM_COLUMNS = 5;
const CARD_HEIGHT = Math.round(CardConfig.portrait.width / CardConfig.portrait.aspectRatio);
const ROW_HEIGHT = CARD_HEIGHT + Spacing.cardGap; // card height + gap

export function SearchScreen({ navigation }: Props) {
  const { t } = useTranslation(["common", "nav"]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const resultsRef = useRef<FlatList>(null);

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

  const scrollToRow = useCallback((index: number) => {
    const row = Math.floor(index / NUM_COLUMNS);
    resultsRef.current?.scrollToOffset({ offset: Math.max(0, row * ROW_HEIGHT - 60), animated: true });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep, paddingTop: 32 }}>
      {/* Back button */}
      <View style={{ paddingHorizontal: Spacing.screenPadding, marginBottom: 16 }}>
        <Focusable variant="button" onPress={() => navigation.goBack()} style={{ alignSelf: "flex-start" }}>
          <View style={{
            paddingHorizontal: 16, paddingVertical: 8,
            borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1, borderColor: Colors.glassBorder,
          }}>
            <Text style={{ color: Colors.accentPurpleLight, fontSize: 16, fontWeight: "600" }}>
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
            onVoiceResult={(text) => setQuery(text)}
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
              ref={resultsRef}
              data={results}
              numColumns={NUM_COLUMNS}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={5}
              contentContainerStyle={{ paddingHorizontal: 32, paddingVertical: 24 }}
              keyExtractor={(item) => item.Id}
              columnWrapperStyle={{ gap: Spacing.cardGap, marginBottom: Spacing.cardGap }}
              getItemLayout={(_, index) => ({
                length: ROW_HEIGHT,
                offset: ROW_HEIGHT * Math.floor(index / NUM_COLUMNS),
                index,
              })}
              renderItem={({ item, index }) => (
                <Focusable variant="card" onPress={() => navigateToDetail(item)} onFocus={() => scrollToRow(index)}>
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
