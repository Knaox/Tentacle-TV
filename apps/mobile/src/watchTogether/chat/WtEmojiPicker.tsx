import { memo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { EMOJI_CATEGORIES } from "@tentacle-tv/shared";
import { PLAYER, RADIUS } from "@/theme";

const CELL = 44;

/**
 * Le sélecteur d'emojis du chat — les MÊMES catégories que le bureau
 * (`EMOJI_CATEGORIES`, shared). Il reste ouvert : on enchaîne les réactions
 * d'un toucher chacune (la couche des réactions les regroupe en rafale).
 * Cellules de 44 pt, puces de catégorie défilantes.
 */
export const WtEmojiPicker = memo(function WtEmojiPicker({ width, onPick }: {
  /** Largeur disponible (le panneau) ; à défaut, celle de la fenêtre. */
  width?: number;
  onPick: (emoji: string) => void;
}) {
  const { t } = useTranslation("watchTogether");
  const window = useWindowDimensions();
  const [categoryId, setCategoryId] = useState(EMOJI_CATEGORIES[0]?.id ?? "");
  const category = EMOJI_CATEGORIES.find((c) => c.id === categoryId) ?? EMOJI_CATEGORIES[0];
  const columns = Math.max(5, Math.floor(((width ?? Math.min(window.width, 420)) - 16) / CELL));

  return (
    <View style={st.wrap} testID="wt-emoji-picker">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
        {EMOJI_CATEGORIES.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setCategoryId(c.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: c.id === categoryId }}
            accessibilityLabel={t(c.labelKey)}
            style={[st.chip, c.id === categoryId && st.chipActive]}
          >
            <Text style={st.chipIcon}>{c.icon}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        key={columns}
        data={category?.emojis ?? []}
        keyExtractor={(e, i) => `${e}-${i}`}
        numColumns={columns}
        contentContainerStyle={st.grid}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPick(item)}
            accessibilityRole="button"
            accessibilityLabel={item}
            style={({ pressed }) => [st.cell, pressed && st.pressed]}
          >
            <Text style={st.emoji}>{item}</Text>
          </Pressable>
        )}
      />
    </View>
  );
});

const st = StyleSheet.create({
  wrap: { height: 240 },
  chips: { gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  chip: { width: 44, height: 36, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: PLAYER.fillSoft },
  chipIcon: { fontSize: 20 },
  grid: { paddingHorizontal: 8, paddingBottom: 8 },
  cell: { width: CELL, height: CELL, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.md },
  pressed: { backgroundColor: PLAYER.fillSoft, transform: [{ scale: 0.9 }] },
  emoji: { fontSize: 26 },
});
