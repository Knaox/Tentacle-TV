import { View, Text, Pressable, FlatList, Linking } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSpecialFeatures, useJellyfinClient } from "@tentacle-tv/api-client";
import { spacing, FONT_FAMILY, RADIUS, useTheme } from "@/theme";

interface RemoteTrailer { Url: string; Name?: string }

interface Tile {
  key: string;
  title: string;
  sub: string;
  thumb: string;
  onPress: () => void;
}

/** Extrait l'ID vidéo YouTube d'une URL (watch?v=, youtu.be/, embed/). */
function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

const W = 168;
const H = 95;

/**
 * Rangée d'extras (mobile) : special features locaux (lus dans le player) +
 * bandes-annonces distantes YouTube (ouvertes dans le navigateur). Se masque
 * d'elle-même si aucun extra. Titre optionnel (nom de saison).
 */
export function MobileExtrasRow({
  itemId,
  remoteTrailers,
  title,
}: {
  itemId: string;
  remoteTrailers?: RemoteTrailer[];
  title?: string;
}) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const client = useJellyfinClient();
  const { colors } = useTheme();
  const { data: features } = useSpecialFeatures(itemId);

  const tiles: Tile[] = [];
  for (const f of features ?? []) {
    tiles.push({
      key: `local-${f.Id}`,
      title: f.Name ?? t("extras"),
      sub: f.Type ?? "",
      thumb: client.getImageUrl(f.Id, "Primary", { width: 360, quality: 75 }),
      onPress: () => router.push(`/watch/${f.Id}`),
    });
  }
  for (const r of remoteTrailers ?? []) {
    const id = youtubeId(r.Url);
    if (!id) continue;
    tiles.push({
      key: `remote-${id}`,
      title: r.Name ?? t("trailer"),
      sub: "YouTube",
      thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      onPress: () => Linking.openURL(r.Url).catch(() => {}),
    });
  }

  if (tiles.length === 0) return null;

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
        data={tiles}
        keyExtractor={(tl) => tl.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: 12 }}
        renderItem={({ item: tile }) => (
          <Pressable onPress={tile.onPress} style={({ pressed }) => [{ width: W }, pressed && { opacity: 0.8 }]}>
            <View style={{ width: W, height: H, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: colors.surface.s2, borderWidth: 1, borderColor: colors.border.subtle }}>
              <Image source={{ uri: tile.thumb }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.overlay.scrimSoft, alignItems: "center", justifyContent: "center" }}>
                  <Feather name="play" size={16} color={colors.cta.brandFg} />
                </View>
              </View>
            </View>
            <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 13, fontFamily: FONT_FAMILY.medium, color: colors.text.primary }}>{tile.title}</Text>
            {tile.sub ? <Text numberOfLines={1} style={{ fontSize: 11, color: colors.text.tertiary }}>{tile.sub}</Text> : null}
          </Pressable>
        )}
      />
    </View>
  );
}
