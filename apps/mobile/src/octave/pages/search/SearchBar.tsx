/**
 * Octave mobile — la barre de recherche : un champ en verre (Liquid Glass sur
 * iOS 26, flou ailleurs), loupe, ✕ pour effacer, « Rechercher » au clavier.
 * Pendant la frappe : des suggestions seulement ; la validation lance la
 * recherche complète. Une fine barre d'attente sous le champ, de place réservée.
 */

import { forwardRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react-native";
import { GlassSurface } from "@/components/ui";
import { typography, useTheme } from "@/theme";

interface SearchBarProps {
  value: string;
  onChange: (text: string) => void;
  onSubmit: (text: string) => void;
  onClear: () => void;
  onFocus?: () => void;
  preparing: boolean;
}

export const SearchBar = forwardRef<TextInput, SearchBarProps>(function SearchBar({ value, onChange, onSubmit, onClear, onFocus, preparing }, ref) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  return (
    <View>
      <GlassSurface tier="dropdown" tint="regular" radius={14} interactive style={styles.field}>
        <Search size={18} color={theme.colors.text.tertiary} />
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChange}
          onFocus={onFocus}
          onSubmitEditing={() => value.trim() && onSubmit(value.trim())}
          placeholder={t("search.placeholder")}
          placeholderTextColor={theme.colors.text.quaternary}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="never"
          accessibilityLabel={t("search.title")}
          style={[typography.body, styles.input, { color: theme.colors.text.primary }]}
        />
        {value ? (
          <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("search.clear")} style={styles.clear}>
            <X size={16} color={theme.colors.text.secondary} />
          </Pressable>
        ) : null}
      </GlassSurface>
      <View style={styles.track} accessibilityElementsHidden>
        {preparing ? <Animated.View entering={FadeIn.delay(150)} exiting={FadeOut} style={[styles.bar, { backgroundColor: theme.colors.brand.accent }]} /> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, minHeight: 46 },
  input: { flex: 1, paddingVertical: 10 },
  clear: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  track: { height: 2, marginTop: 6, marginHorizontal: 6, borderRadius: 1, overflow: "hidden" },
  bar: { height: 2, width: "30%", borderRadius: 1 },
});
