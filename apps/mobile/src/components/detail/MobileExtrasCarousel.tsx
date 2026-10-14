import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useItemsExtras, useJellyfinClient, type ExtrasOwner } from "@tentacle-tv/api-client";
import {
  buildExtraEntries, catalogTiles, parseYouTubeId, scopeName, sortTrailersByLang, withSeasonNames,
  type CatalogRow, type CatalogTile, type ExtraEntry, type RichTrailer,
} from "@tentacle-tv/shared";
import { spacing, FONT_FAMILY, RADIUS, useTheme } from "@/theme";
import { trailerRouteHref, type TrailerRouteItemType } from "@/trailers/trailerRoute";

const W = 168;
const H = 95;

/** La fiche dont l'écran des bandes-annonces rejoue le catalogue (celle qu'on regarde). */
export interface ExtrasCatalogOwner {
  itemId: string;
  itemType: string;
}

/** Une tuile du carrousel : un extra du modèle partagé, ou une vidéo du catalogue. */
type RowTile = { kind: "extra"; entry: ExtraEntry } | { kind: "catalog"; tile: CatalogTile };

interface Props {
  /** Les titres dont on réunit les extras locaux (une série et ses saisons, une saison…). */
  owners: readonly ExtrasOwner[];
  /** Les vidéos YouTube d'avant le catalogue ; vide avec lui. */
  remote: RichTrailer[];
  /** Les vidéos du catalogue (AlloCiné compris). */
  catalog: CatalogRow | null;
  /** Le nom de la saison quand le carrousel ne montre qu'elle. */
  title?: string;
  /** Plusieurs saisons réunies : chaque tuile dit la sienne (`useFicheExtras`). */
  seasonNames: ReadonlyMap<string, string> | null;
  fiche: ExtrasCatalogOwner;
}

/**
 * Le carrousel « Extras » de la fiche (mobile) — UN seul par fiche
 * (`ficheExtrasPlan`, shared) : bandes-annonces locales et bonus (lus dans le
 * player), puis les vidéos en ligne — celles du CATALOGUE quand le serveur le
 * sert, sinon les vidéos YouTube d'avant —, toutes lues dans l'app par
 * l'écran des bandes-annonces, sans publicité. Quand il réunit plusieurs
 * saisons, chaque tuile dit la sienne (« Saison 2 · Coulisses », « Saison 6 ·
 * VF · AlloCiné »). Ordre et libellés du modèle partagé (`buildExtraEntries`,
 * `catalogTiles`). Se masque de lui-même sans extra.
 */
export function MobileExtrasCarousel({ owners, remote, catalog, title, seasonNames, fiche }: Props) {
  const { t, i18n } = useTranslation("common");
  const router = useRouter();
  const client = useJellyfinClient();
  const { colors } = useTheme();
  const { local, ownerOf } = useItemsExtras(owners);

  const tiles = useMemo<RowTile[]>(() => {
    const entries = withSeasonNames(buildExtraEntries(t, local, catalog ? [] : sortTrailersByLang(remote, i18n.language)), ownerOf, seasonNames);
    const videos = catalog ? catalogTiles(t, catalog, seasonNames ? (scope) => scopeName(t, scope) : undefined) : [];
    return [...entries.map((entry): RowTile => ({ kind: "extra", entry })), ...videos.map((tile): RowTile => ({ kind: "catalog", tile }))];
  }, [t, local, ownerOf, catalog, remote, seasonNames, i18n.language]);

  if (tiles.length === 0) return null;

  const open = (row: RowTile) => {
    if (row.kind === "catalog") {
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: 12 }}
      >
        {tiles.map((row) => {
          const thumb = thumbOf(row);
          const text = textOf(row);
          return (
            <Pressable
              key={keyOf(row)}
              onPress={() => open(row)}
              accessibilityRole="button"
              accessibilityLabel={text.subtitle ? `${text.title}, ${text.subtitle}` : text.title}
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
              <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 13, fontFamily: FONT_FAMILY.medium, color: colors.text.primary }}>{text.title}</Text>
              {text.subtitle ? <Text numberOfLines={1} style={{ fontSize: 11, color: colors.text.tertiary }}>{text.subtitle}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
