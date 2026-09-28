import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatEpisodeCode, resolveBannerImage, resolvePosterImage, type MediaItem } from "@tentacle-tv/shared";
import { TVCardImage } from "../TVCardImage";
import { TVCloseButton } from "../../TVCloseButton";
import { Colors, Fonts } from "../../../theme/colors";
import type { CardSheetTarget } from "./cardSheetTarget";

const POSTER = { width: 84, height: 126 };
const STILL = { width: 176, height: 99 };

/**
 * L'en-tête de la feuille : la vignette de la carte, son titre et sa ligne de
 * contexte — ce que la carte MONTRE, que le voile vient de recouvrir —, et la
 * croix, la sortie visible de tous les panneaux (Retour ferme aussi).
 *
 * Les images reprennent EXACTEMENT les paramètres des cartes
 * (`TVPosterFrame`, `TVEpisodeCard`, `TVRecoCard`) : c'est la même URL, déjà
 * en cache, aucune requête de plus.
 */
export const TVCardSheetHeader = memo(function TVCardSheetHeader({ target, onClose }: {
  target: CardSheetTarget;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const landscape = target.kind === "media" && target.variant === "landscape";

  let imageUrl: string | null;
  let title: string;
  let subtitle: string | null;
  if (target.kind === "reco") {
    const { item } = target;
    imageUrl = item.jellyfinItemId
      ? client.getImageUrl(item.jellyfinItemId, "Primary", { height: 360, quality: 85 })
      : null;
    title = item.title;
    subtitle = item.year != null ? String(item.year) : null;
  } else {
    const { item } = target;
    const image = landscape ? resolveBannerImage(item) : resolvePosterImage(item, "series");
    imageUrl = image
      ? client.getImageUrl(image.id, image.type, {
          ...(landscape ? { width: 540, quality: 80 } : { height: 360, quality: 85 }),
          ...(image.tag ? { tag: image.tag } : {}),
        })
      : null;
    ({ title, subtitle } = mediaHeading(item, landscape, (count) => t("addedEpisodes", { count })));
  }

  const art = landscape ? STILL : POSTER;
  return (
    <View style={styles.header}>
      <View style={[styles.art, art]}>
        <TVCardImage uri={imageUrl} style={{ width: "100%", height: "100%" }} />
      </View>
      <View style={styles.text}>
        <Text numberOfLines={2} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <TVCloseButton onPress={onClose} />
    </View>
  );
});

/**
 * Le titre d'une carte Jellyfin : une AFFICHE d'épisode est le visage de sa
 * série (titre = la série) ; une VIGNETTE porte le nom de l'épisode. Mêmes
 * règles que les légendes des cartes (`TVPosterMeta`, `TVEpisodeCard`).
 */
function mediaHeading(
  item: MediaItem,
  landscape: boolean,
  addedLabel: (count: number) => string,
): { title: string; subtitle: string | null } {
  const added = item.RecentlyAddedCount ?? 0;
  if (added > 1) return { title: item.Name, subtitle: addedLabel(added) };
  if (item.Type === "Episode") {
    const code = item.ParentIndexNumber != null && item.IndexNumber != null
      ? formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber, { style: "padded" })
      : null;
    return landscape
      ? { title: item.Name, subtitle: [item.SeriesName, code].filter(Boolean).join(" · ") || null }
      : { title: item.SeriesName ?? item.Name, subtitle: [code, item.Name].filter(Boolean).join(" · ") || null };
  }
  return { title: item.Name, subtitle: item.ProductionYear ? String(item.ProductionYear) : null };
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 20 },
  art: { borderRadius: 10, overflow: "hidden", backgroundColor: Colors.bgCard },
  text: { flex: 1, paddingTop: 4, gap: 6 },
  title: { color: Colors.textPrimary, fontSize: 26, lineHeight: 32, fontFamily: Fonts.extrabold },
  subtitle: { color: Colors.textSecondary, fontSize: 17, fontFamily: Fonts.medium },
});
