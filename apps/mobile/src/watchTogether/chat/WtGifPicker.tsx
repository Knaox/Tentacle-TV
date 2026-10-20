import { memo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { useGifSearch, type GifItem } from "@tentacle-tv/api-client";
import { FONT_FAMILY, PLAYER, RADIUS } from "@/theme";

const COLUMNS = 3;
const GAP = 6;

/**
 * Le sélecteur de GIF du chat, sur la vidéo (couleurs du lecteur) : les
 * tendances, ou une recherche ; un toucher envoie au groupe et referme.
 * Serveur sans clé Klipy (ou d'avant le relais) : il le dit, sans erreur.
 */
export const WtGifPicker = memo(function WtGifPicker({ width, onSend, onClose }: {
  /** Largeur disponible (le panneau du groupe). */
  width?: number;
  onSend: (gif: GifItem) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("watchTogether");
  const [query, setQuery] = useState("");
  const { data, isLoading } = useGifSearch(query, i18n.language);
  const window = useWindowDimensions();
  const cell = Math.floor(((width ?? Math.min(window.width, 360)) - 16 - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <View style={st.wrap} testID="wt-gif-picker">
      <View style={st.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("gifSearchPlaceholder")}
          placeholderTextColor={PLAYER.textTertiary}
          style={st.input}
          autoCorrect={false}
          accessibilityLabel={t("gifSearchPlaceholder")}
        />
        <Pressable onPress={onClose} accessibilityRole="button" style={st.close}>
          <Text style={st.closeLabel}>{t("close")}</Text>
        </Pressable>
      </View>
      {isLoading && !data ? (
        <ActivityIndicator style={st.state} color={PLAYER.text} />
      ) : data && !data.configured ? (
        <Text style={st.message}>{t("gifNotConfigured")}</Text>
      ) : data?.error ? (
        <Text style={st.message}>{t("gifError")}</Text>
      ) : (
        <FlatList
          data={data?.results ?? []}
          keyExtractor={(g) => g.id}
          numColumns={COLUMNS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, padding: 8 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable onPress={() => onSend(item)} accessibilityRole="button" accessibilityLabel={t("gifSendAria")}>
              <Image source={{ uri: item.url }} style={{ width: cell, height: cell, borderRadius: RADIUS.md }} contentFit="cover" />
            </Pressable>
          )}
          ListEmptyComponent={<Text style={st.message}>{t("gifNoResults")}</Text>}
          ListFooterComponent={<Text style={st.attribution}>{t("gifAttribution")}</Text>}
        />
      )}
    </View>
  );
});

const st = StyleSheet.create({
  wrap: { flex: 1, minHeight: 0 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8 },
  input: {
    flex: 1, minHeight: 44, paddingHorizontal: 14, borderRadius: RADIUS.pill, color: PLAYER.text, fontSize: 16,
    backgroundColor: PLAYER.fillSoft, fontFamily: FONT_FAMILY.regular,
  },
  close: { minHeight: 44, paddingHorizontal: 10, justifyContent: "center" },
  closeLabel: { color: PLAYER.textSecondary, fontSize: 14, fontFamily: FONT_FAMILY.semibold },
  state: { marginTop: 24 },
  message: { color: PLAYER.textTertiary, fontSize: 14, textAlign: "center", padding: 24, fontFamily: FONT_FAMILY.regular },
  attribution: { color: PLAYER.textTertiary, fontSize: 11, textAlign: "center", paddingVertical: 8, fontFamily: FONT_FAMILY.regular },
});
