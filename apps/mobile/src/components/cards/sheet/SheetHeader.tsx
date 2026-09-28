import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatEpisodeCode, resolvePosterImage, type MediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, SHADOW_RN, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { CardSheetTarget } from "./cardSheetTarget";

type Client = ReturnType<typeof useJellyfinClient>;
const NONE = { poster: null, backdrop: null } as const;

interface Props {
  target: CardSheetTarget;
  /** L'item chargé (la fiche), sinon le visage de la carte. */
  item: MediaItem | null;
}

/**
 * L'en-tête de la feuille : l'arrière-plan du titre sous un voile, l'affiche,
 * le libellé de la carte et une ligne qui dit ce qu'on tient — « 2019 · Film »,
 * ou l'épisode : c'est lui que Lire et « vu » visent, quand Ma liste et les
 * favoris visent sa série.
 */
export const SheetHeader = memo(function SheetHeader({ target, item }: Props) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const { poster, backdrop } = sheetImages(target, item, client);
  const subtitle = sheetSubtitle(target, item, { series: t("series"), movie: t("movie") });

  return (
    <View style={st.hero}>
      {backdrop && <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={200} />}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.glass.tintStrong }]} />
      <View style={st.content}>
        <View style={st.poster}>
          {poster ? (
            <Image source={{ uri: poster }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={200} />
          ) : (
            <Text style={st.letter}>{target.title.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={st.texts}>
          <Text style={st.title} numberOfLines={2} accessibilityRole="header">{target.title}</Text>
          {subtitle !== null && <Text style={st.meta} numberOfLines={1}>{subtitle}</Text>}
        </View>
      </View>
    </View>
  );
});

/**
 * L'affiche (la série pour un épisode, comme la carte) et l'arrière-plan. Un
 * titre lu sur le disque ne demande rien au serveur : les visuels de
 * l'appelant, sinon aucun (l'initiale tient la place de l'affiche).
 */
function sheetImages(target: CardSheetTarget, item: MediaItem | null, client: Client) {
  if (target.images) return target.images;
  if (target.local || !item) return NONE;
  const resolved = resolvePosterImage(item, "series");
  const backdropId = item.Type === "Episode" ? (item.ParentBackdropItemId ?? item.SeriesId ?? item.Id) : item.Id;
  return {
    poster: resolved
      ? client.getImageUrl(resolved.id, resolved.type, { width: 240, quality: 85, ...(resolved.tag ? { tag: resolved.tag } : {}) })
      : null,
    backdrop: client.getImageUrl(backdropId, "Backdrop", { width: 600, quality: 70 }),
  };
}

/** « S01E03 · Titre » (affiche), « Série · S01E03 » (vignette), « 2019 · Film » ailleurs. */
function sheetSubtitle(
  target: CardSheetTarget,
  item: MediaItem | null,
  kinds: { series: string; movie: string },
): string | null {
  if (item?.Type === "Episode") {
    const code = formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber, { style: "padded" });
    if (target.variant === "landscape") return item.SeriesName ? `${item.SeriesName} · ${code}` : code;
    return `${code} · ${item.Name}`;
  }
  const kind = item?.Type;
  const year = item?.ProductionYear;
  const label = kind === "Series" ? kinds.series : kind === "Movie" ? kinds.movie : null;
  const parts = [year ? String(year) : null, label].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    hero: {
      marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md, height: 96,
      borderRadius: RADIUS.lg, overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle,
    },
    content: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
    poster: {
      width: 52, height: 76, borderRadius: RADIUS.sm, overflow: "hidden",
      alignItems: "center", justifyContent: "center",
      backgroundColor: t.colors.surface.s2, ...SHADOW_RN.elev2,
    },
    letter: { fontSize: 22, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.disabled },
    texts: { flex: 1, minWidth: 0 },
    title: { fontSize: 16, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, letterSpacing: -0.2, marginBottom: 3 },
    meta: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.brand.light, letterSpacing: 0.2 },
  });
