import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, Linking } from "react-native";
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

/** La fiche dont l'écran des bandes-annonces rejoue le catalogue (celle qu'on regarde). */
export interface ExtrasCatalogOwner {
  itemId: string;
  itemType: string;
}

/** Une tuile de la rangée : un extra du modèle partagé, ou une vidéo du catalogue. */
type RowTile = { kind: "extra"; entry: ExtraEntry } | { kind: "catalog"; tile: CatalogTile };

/** Ce qu'apporte une source au carrousel : un titre (film, série, saison) et ses vidéos en ligne. */
export interface ExtrasSegmentProps {
  owner: ExtrasOwner;
  remoteTrailers: RichTrailer[];
  /** Les vidéos du CATALOGUE pour cette portée (AlloCiné compris), à la place des vidéos YouTube d'avant. */
  catalog?: CatalogRow | null;
  /** La fiche dont l'écran des bandes-annonces rejoue le catalogue. */
  fiche?: ExtrasCatalogOwner;
  /** Le nom de la saison, devant le détail de chaque tuile, dans un carrousel qui en réunit plusieurs. */
  label?: string;
}

/**
 * Les tuiles d'UNE source, posées dans le carrousel : bandes-annonces locales
 * et bonus (lus dans le player), puis les vidéos en ligne — celles du
 * CATALOGUE de cette portée quand le serveur le sert, sinon les vidéos
 * YouTube d'avant —, toutes lues dans l'app par l'écran des bandes-annonces,
 * sans publicité. Ordre et libellés du modèle partagé (`buildExtraEntries`,
 * `catalogTiles`). Rien quand la source n'a rien.
 */
function ExtrasSegment({ owner, remoteTrailers, catalog = null, fiche, label }: ExtrasSegmentProps) {
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
  const textOf = (row: RowTile) => {
    const text = row.kind === "extra"
      ? { title: row.entry.title, subtitle: row.entry.subtitle }
      : { title: row.tile.title, subtitle: row.tile.subtitle };
    return label ? { title: text.title, subtitle: text.subtitle ? `${label} · ${text.subtitle}` : label } : text;
  };
  const thumbOf = (row: RowTile) => {
    if (row.kind === "catalog") return row.tile.thumbUrl;
    const { entry } = row;
    return entry.source === "local" ? client.getImageUrl(entry.itemId, "Primary", { width: 360, quality: 75 }) : entry.thumbUrl;
  };

  return (
    <>
      {tiles.map((row) => {
        const thumb = thumbOf(row);
        const entry = textOf(row);
        return (
          <Pressable
            key={keyOf(row)}
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
      })}
    </>
  );
}

/**
 * Le carrousel « Extras » de la fiche (mobile) : UN seul par fiche, qui
 * réunit les sources que la section lui donne (la série et ses saisons, ou
 * la saison d'un épisode) — jamais une rangée par saison empilée. La section
 * ne le monte que s'il a quelque chose à montrer.
 */
export function MobileExtrasCarousel({ segments, title }: { segments: readonly (ExtrasSegmentProps & { key: string })[]; title?: string }) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  if (segments.length === 0) return null;
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
        {segments.map(({ key, ...segment }) => <ExtrasSegment key={key} {...segment} />)}
      </ScrollView>
    </View>
  );
}
