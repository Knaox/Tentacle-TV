import { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSearchItems } from "@tentacle-tv/api-client";
import { MobileMediaCard } from "../components/MobileMediaCard";
import { FadeIn, SubtleBackground } from "../components/ui";
import { colors, spacing, typography, BRAND, BORDER, FONT_FAMILY, RADIUS, SURFACE } from "../theme";

/**
 * Search — modal full-screen avec input top auto-focus, suggestions de
 * démarrage, résultats 2 colonnes. BlurView header pour effet glass.
 */
const GRID_GAP = 14;

export function SearchScreen() {
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  // Largeur de card calculée pour 2 colonnes — espacement strictement uniforme
  const cardWidth = useMemo(
    () => Math.floor((SCREEN_W - 2 * spacing.screenPadding - GRID_GAP) / 2),
    [SCREEN_W],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const { data: results, isLoading } = useSearchItems(debounced);

  const handleResultPress = (id: string) => {
    // Dismiss the modal first, then push the detail route on the underlying
    // stack. setTimeout(0) defers push to the next tick so the modal dismiss
    // is queued first — InteractionManager.runAfterInteractions is unreliable
    // here (callback may never fire when prior screens are still doing work).
    router.dismiss();
    setTimeout(() => router.push(`/media/${id}`), 0);
  };

  return (
    <SubtleBackground ambient>
      {/* Header glass — input search + close button */}
      <View style={[st.headerWrap, { paddingTop: insets.top + spacing.md }]}>
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.45)" }]} />
        <View style={st.headerRow}>
          <View style={st.searchWrap}>
            <Feather name="search" size={16} color="rgba(255,255,255,0.55)" />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder={t("searchMediaLong")}
              placeholderTextColor="rgba(255,255,255,0.35)"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t("searchMediaLong")}
              style={st.input}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery("")}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t("clearSearch")}
                style={st.clearBtn}
              >
                <Feather name="x" size={14} color="rgba(255,255,255,0.65)" />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("cancel")}
            style={st.cancelBtn}
          >
            <Text style={st.cancelTxt}>{t("cancel")}</Text>
          </Pressable>
        </View>
      </View>

      {/* Body */}
      {isLoading && debounced.length >= 2 && (
        <View style={st.center}>
          <ActivityIndicator size="large" color={BRAND.violet} />
        </View>
      )}

      {!isLoading && debounced.length >= 2 && (!results || results.length === 0) && (
        <FadeIn style={{ flex: 1 }}>
          <View style={st.center}>
            <Feather name="search" size={48} color={BRAND.light} style={{ opacity: 0.5, marginBottom: 16 }} />
            <Text style={st.emptyTitle}>{t("noResults")}</Text>
            <Text style={st.emptyHint}>{t("noResultsHint", { defaultValue: "Essayez d'autres mots-clés" })}</Text>
          </View>
        </FadeIn>
      )}

      {results && results.length > 0 && (
        <FadeIn delay={50} style={{ flex: 1 }}>
          <FlatList
            data={results}
            numColumns={2}
            keyExtractor={(item) => item.Id}
            contentContainerStyle={{
              paddingHorizontal: spacing.screenPadding,
              paddingTop: spacing.lg,
              paddingBottom: insets.bottom + 100,
            }}
            columnWrapperStyle={{ gap: GRID_GAP, marginBottom: GRID_GAP }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <MobileMediaCard
                item={item}
                width={cardWidth}
                onPress={() => handleResultPress(item.Id)}
              />
            )}
          />
        </FadeIn>
      )}

      {debounced.length < 2 && !isLoading && (
        <FadeIn style={{ flex: 1 }}>
          <View style={st.center}>
            <View style={st.iconRing}>
              <Feather name="search" size={32} color={BRAND.violet} />
            </View>
            <Text style={st.startTitle}>{t("searchTitle", { defaultValue: "Rechercher" })}</Text>
            <Text style={st.startHint}>{t("typeMinChars")}</Text>
          </View>
        </FadeIn>
      )}
    </SubtleBackground>
  );
}

const st = StyleSheet.create({
  headerWrap: { paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER.subtle },
  headerRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm, paddingHorizontal: spacing.screenPadding },
  searchWrap: {
    flex: 1, flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: BORDER.subtle,
    borderRadius: RADIUS.lg, paddingHorizontal: spacing.md, height: 44,
  },
  input: {
    flex: 1, ...typography.body, fontFamily: FONT_FAMILY.regular,
    color: colors.textPrimary, paddingVertical: 0, letterSpacing: -0.1,
  },
  clearBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  cancelBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  cancelTxt: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: BRAND.light, letterSpacing: 0.1 },
  center: { flex: 1, justifyContent: "center" as const, alignItems: "center" as const, padding: spacing.xl },
  emptyTitle: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, fontSize: 17, color: colors.textPrimary, marginBottom: 6 },
  emptyHint: { ...typography.caption, fontFamily: FONT_FAMILY.regular, color: colors.textMuted, textAlign: "center" as const, maxWidth: 280 },
  iconRing: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: SURFACE.s2, borderWidth: 1, borderColor: "rgba(139,92,246,0.25)",
    alignItems: "center" as const, justifyContent: "center" as const, marginBottom: 18,
  },
  startTitle: { ...typography.title, fontFamily: FONT_FAMILY.extrabold, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.4, marginBottom: 6 },
  startHint: { ...typography.body, fontFamily: FONT_FAMILY.medium, color: colors.textMuted, textAlign: "center" as const, maxWidth: 280, lineHeight: 21 },
});
