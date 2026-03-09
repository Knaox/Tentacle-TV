import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator, Pressable, InteractionManager } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useSearchItems } from "@tentacle-tv/api-client";
import { MobileMediaCard } from "../components/MobileMediaCard";
import { FadeIn } from "../components/ui";
import { colors, spacing, typography } from "../theme";

export function SearchScreen() {
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const { data: results, isLoading } = useSearchItems(debounced);

  return (
    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)" }}>
      <View style={{
        paddingHorizontal: spacing.screenPadding,
        paddingTop: insets.top + spacing.md,
        paddingBottom: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}>
        <View style={{
          flex: 1, flexDirection: "row", alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.surfaceElevated,
          borderRadius: spacing.cardRadius, paddingHorizontal: spacing.md,
        }}>
          <Feather name="search" size={16} color={colors.textDim} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={t("searchMediaLong")}
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t("searchMediaLong")}
            style={{
              flex: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.md,
              color: colors.textPrimary, ...typography.body,
            }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("clearSearch")}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("close")}>
          <Feather name="x" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {isLoading && debounced.length >= 2 && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}

      {!isLoading && debounced.length >= 2 && (!results || results.length === 0) && (
        <FadeIn style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ ...typography.body, color: colors.textMuted }}>{t("noResults")}</Text>
          </View>
        </FadeIn>
      )}

      {results && results.length > 0 && (
        <FadeIn delay={50} style={{ flex: 1 }}>
          <FlatList
            data={results}
            numColumns={2}
            keyExtractor={(item) => item.Id}
            contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingBottom: insets.bottom + 100 }}
            columnWrapperStyle={{ gap: spacing.sm, marginBottom: spacing.sm }}
            renderItem={({ item }) => (
              <View style={{ flex: 1, maxWidth: "50%" }}>
                <MobileMediaCard item={item} onPress={() => {
                  router.dismiss();
                  InteractionManager.runAfterInteractions(() => {
                    router.push(`/media/${item.Id}`);
                  });
                }} />
              </View>
            )}
          />
        </FadeIn>
      )}

      {debounced.length < 2 && !isLoading && (
        <FadeIn style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Feather name="search" size={48} color={colors.textDim} style={{ marginBottom: 16 }} />
            <Text style={{ ...typography.body, color: colors.textDim }}>
              {t("typeMinChars")}
            </Text>
          </View>
        </FadeIn>
      )}
    </View>
  );
}
