import { useMemo } from "react";
import { View, Text, Pressable, FlatList, Linking } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useItemExtras, useJellyfinClient, type ExtrasOwner } from "@tentacle-tv/api-client";
import {
  buildExtraEntries, catalogTiles, parseYouTubeId, sortTrailersByLang, type CatalogRow, type CatalogTile, type ExtraEntry, type RichTrailer,
} from "@tentacle-tv/shared";
import { trailerRouteHref, type TrailerRouteItemType } from "@/trailers/trailerRoute";
import { spacing, FONT_FAMILY, RADIUS, useTheme } from "@/theme";

const W = 168;
const H = 95;

/** La fiche dont l'écran des bandes-annonces rejoue le catalogue. */
export interface ExtrasCatalogOwner {
  itemId: string;
  itemType: string;
}

/** Une tuile de la rangée : un extra du modèle partagé, ou une vidéo du catalogue. */
type RowTile = { kind: "extra"; entry: ExtraEntry } | { kind: "catalog"; tile: CatalogTile };

/**
 * Rangée d'extras (mobile) : bandes-annonces locales et bonus (lus dans le
 * player), puis les vidéos en ligne — celles du CATALOGUE de cette portée
 * quand le serveur le sert (`catalog`, AlloCiné compris), sinon les vidéos
 * YouTube d'avant —, toutes lues dans l'app par l'écran des bandes-annonces,
 * sans publicité. Ordre et libellés du modèle partagé (`buildExtraEntries`,
 * `catalogTiles`). Se masque d'elle-même si aucun extra. Titre optionnel
 * (nom de saison).
 */
export function MobileExtrasRow({
  owner,
  remoteTrailers,
  title,
  catalog = null,
  fiche,
}: {
  owner: ExtrasOwner;
  remoteTrailers: RichTrailer[];
  title?: string;
  catalog?: CatalogRow | null;
  fiche?: ExtrasCatalogOwner;
}) {
  const { t, i18n } = useTranslation("common");
  const router = useRouter();
  const client = useJellyfinClient();
  const { colors } = useTheme();
  const { local } = useItemExtras(owner);
  const tiles = useMemo<RowTile[]>(() => [
    ...buildExtraEntries(t, local, catalog ? [] : sortTrailersByLang(remoteTrailers, i18n.language))
      .map((entry): RowTile => ({ kind: "extra", entry })),
    ...(catalog && fiche ? catalogTiles(t, catalog).map((tile): RowTile => ({ kind: "catalog", tile })) : []),
  ], [t, local, catalog, fiche, remoteTrailers, i18n.language]);

  if (tiles.length === 0) return null;

  const open = (row: RowTile) => {
    if (row.kind === "catalog") {
      if (!fiche) return;
      const target = { kind: "item" as const, itemId: fiche.itemId, itemType: fiche.itemType as TrailerRouteItemType };
      router.push(trailerRouteHref({ target, start: row.tile.key }) as never);
      return;
    }
    const { entry } = row;
    if (entry.source === "local") {
      router.push(`/watch/${entry.itemId}`);
      return;
    }
    // Une vidéo YouTube d'avant le catalogue : dans l'app, par le relais du serveur.
    const ytId = parseYouTubeId(entry.trailer.Url);
    if (ytId) router.push(trailerRouteHref({ target: { kind: "youtube", ytId, name: entry.title } }) as never);
    else Linking.openURL(entry.trailer.Url).catch(() => {});
  };
  const keyOf = (row: RowTile) => (row.kind === "extra" ? row.entry.key : row.tile.key);
  const textOf = (row: RowTile) => (row.kind === "extra"
    ? { title: row.entry.title, subtitle: row.entry.subtitle }
    : { title: row.tile.title, subtitle: row.tile.subtitle });
  const thumbOf = (row: RowTile) => {
    if (row.kind === "catalog") return row.tile.thumbUrl;
    const { entry } = row;
    return entry.source === "local" ? client.getImageUrl(entry.itemId, "Primary", { width: 360, quality: 75 }) : entry.thumbUrl;
  };

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
        keyExtractor={keyOf}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: 12 }}
        renderItem={({ item: row }) => {
          const thumb = thumbOf(row);
          const entry = textOf(row);
          return (
            <Pressable
              onPress={() => open(row)}
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
