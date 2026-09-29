import { useMemo } from "react";
import { View, Text, Pressable, FlatList, Linking } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useItemExtras, useJellyfinClient, type ExtrasOwner } from "@tentacle-tv/api-client";
import { buildExtraEntries, sortTrailersByLang, type ExtraEntry, type RichTrailer } from "@tentacle-tv/shared";
import { spacing, FONT_FAMILY, RADIUS, useTheme } from "@/theme";

const W = 168;
const H = 95;

/**
 * Rangée d'extras (mobile) : bandes-annonces locales et bonus (lus dans le
 * player), puis vidéos distantes YouTube (confiées au système : l'app YouTube
 * ou le navigateur) — ordre et libellés du modèle partagé
 * (`buildExtraEntries`). Se masque d'elle-même si aucun extra. Titre optionnel
 * (nom de saison).
 */
export function MobileExtrasRow({
  owner,
  remoteTrailers,
  title,
}: {
  owner: ExtrasOwner;
  remoteTrailers: RichTrailer[];
  title?: string;
}) {
  const { t, i18n } = useTranslation("common");
  const router = useRouter();
  const client = useJellyfinClient();
  const { colors } = useTheme();
  const { local } = useItemExtras(owner);
  const entries = useMemo(
    () => buildExtraEntries(t, local, sortTrailersByLang(remoteTrailers, i18n.language)),
    [t, local, remoteTrailers, i18n.language],
  );

  if (entries.length === 0) return null;

  const open = (entry: ExtraEntry) => {
    if (entry.source === "local") router.push(`/watch/${entry.itemId}`);
    else Linking.openURL(entry.trailer.Url).catch(() => {});
  };
  const thumbOf = (entry: ExtraEntry) => entry.source === "local"
    ? client.getImageUrl(entry.itemId, "Primary", { width: 360, quality: 75 })
    : entry.thumbUrl;

  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text
        style={{
          fontSize: 18,
          fontFamily: FONT_FAMILY.bold,
          color: colors.text.primary,
          paddingHorizontal: spacing.screenPadding,
          marginBottom: 12,
        }}
      >
        {title ?? t("extras")}
      </Text>
      <FlatList
        horizontal
        data={entries}
        keyExtractor={(entry) => entry.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: 12 }}
        renderItem={({ item: entry }) => {
          const thumb = thumbOf(entry);
          return (
            <Pressable
              onPress={() => open(entry)}
              accessibilityRole="button"
              accessibilityLabel={entry.subtitle ? `${entry.title}, ${entry.subtitle}` : entry.title}
              style={({ pressed }) => [{ width: W }, pressed && { opacity: 0.8 }]}
            >
              <View style={{ width: W, height: H, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: colors.surface.s2, borderWidth: 1, borderColor: colors.border.subtle }}>
                {thumb ? <Image source={{ uri: thumb }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.overlay.scrimSoft, alignItems: "center", justifyContent: "center" }}>
                    <Feather name="play" size={16} color={colors.cta.brandFg} />
                  </View>
                </View>
              </View>
              <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 13, fontFamily: FONT_FAMILY.medium, color: colors.text.primary }}>{entry.title}</Text>
              {entry.subtitle ? <Text numberOfLines={1} style={{ fontSize: 11, color: colors.text.tertiary }}>{entry.subtitle}</Text> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}
