import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { backOrHome } from "@/utils/backOrHome";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useSearchItems } from "@tentacle-tv/api-client";
import { MobileMediaCard } from "../components/MobileMediaCard";
import { FadeIn, SubtleBackground, GlassSurface } from "../components/ui";
import { spacing, typography, FONT_FAMILY, RADIUS, useGrid, useTheme, useThemedStyles, withAlpha, type AppTheme } from "../theme";

/**
 * Search — modal full-screen avec input top auto-focus, suggestions de
 * démarrage, résultats 2 colonnes. BlurView header pour effet glass.
 */
const GRID_GAP = 14;

export function SearchScreen() {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  // 2 colonnes sur iPhone (inchangé), adaptatif sur iPad — gouttière 14.
  const { numColumns, itemWidth: cardWidth, gutter, padding } = useGrid({
    phoneColumns: 2,
    gutter: GRID_GAP,
  });

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
      <View style={[st.headerWrap, { paddingTop: Math.max(insets.top, 24) + spacing.md }]}>
        <GlassSurface intensity={28} radius={0} bordered={false} style={StyleSheet.absoluteFillObject} />
        <View style={st.headerRow}>
          <View style={st.searchWrap}>
            <Feather name="search" size={16} color={colors.text.tertiary} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder={t("searchMediaLong")}
              placeholderTextColor={colors.text.quaternary}
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
                <Feather name="x" size={14} color={colors.text.tertiary} />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => backOrHome(router)}
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
          <ActivityIndicator size="large" color={colors.brand.violet} />
        </View>
      )}

      {!isLoading && debounced.length >= 2 && (!results || results.length === 0) && (
        <FadeIn style={{ flex: 1 }}>
          <View style={st.center}>
            <Feather name="search" size={48} color={colors.brand.light} style={{ opacity: 0.5, marginBottom: 16 }} />
            <Text style={st.emptyTitle}>{t("noResults")}</Text>
            <Text style={st.emptyHint}>{t("noResultsHint", { defaultValue: "Essayez d'autres mots-clés" })}</Text>
          </View>
        </FadeIn>
      )}

      {results && results.length > 0 && (
        <FadeIn delay={50} style={{ flex: 1 }}>
          <FlatList
            key={`search-${numColumns}`}
            data={results}
            numColumns={numColumns}
            keyExtractor={(item) => item.Id}
            contentContainerStyle={{
              paddingHorizontal: padding,
              paddingTop: spacing.lg,
              paddingBottom: insets.bottom + 100,
            }}
            columnWrapperStyle={numColumns > 1 ? { gap: gutter, marginBottom: gutter } : undefined}
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
              <Feather name="search" size={32} color={colors.brand.violet} />
            </View>
            <Text style={st.startTitle}>{t("searchTitle", { defaultValue: "Rechercher" })}</Text>
            <Text style={st.startHint}>{t("typeMinChars")}</Text>
          </View>
        </FadeIn>
      )}
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  headerWrap: { paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border.subtle },
  headerRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm, paddingHorizontal: spacing.screenPadding, width: "100%" as const, maxWidth: 860, alignSelf: "center" as const },
  searchWrap: {
    flex: 1, flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm,
    backgroundColor: t.colors.fill.soft, borderWidth: 1, borderColor: t.colors.border.subtle,
    borderRadius: RADIUS.lg, paddingHorizontal: spacing.md, height: 44,
  },
  input: {
    flex: 1, ...typography.body, fontFamily: FONT_FAMILY.regular,
    color: t.colors.text.primary, paddingVertical: 0, letterSpacing: -0.1,
  },
  clearBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: t.colors.fill.medium,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  cancelBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  cancelTxt: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light, letterSpacing: 0.1 },
  center: { flex: 1, justifyContent: "center" as const, alignItems: "center" as const, padding: spacing.xl },
  emptyTitle: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, fontSize: 17, color: t.colors.text.primary, marginBottom: 6 },
  emptyHint: { ...typography.caption, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary, textAlign: "center" as const, maxWidth: 280 },
  iconRing: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: t.colors.surface.s2, borderWidth: 1, borderColor: withAlpha(t.colors.brand.violet, 0.25, t.colors.brand.glow),
    alignItems: "center" as const, justifyContent: "center" as const, marginBottom: 18,
  },
  startTitle: { ...typography.title, fontFamily: FONT_FAMILY.extrabold, fontSize: 22, color: t.colors.text.primary, letterSpacing: -0.4, marginBottom: 6 },
  startHint: { ...typography.body, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, textAlign: "center" as const, maxWidth: 280, lineHeight: 21 },
});
