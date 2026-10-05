import type { JellyfinClient, RecoRowItem } from "@tentacle-tv/api-client";
import { formatEpisodeCode, latestAdditionsLine, resolveBannerImage, resolvePosterImage, type MediaItem } from "@tentacle-tv/shared";
import type { SheetHeaderModel } from "../../redesign/screens/sheet/ActionSheetView";
import { imagePixels } from "../cards/imagePixels";

/**
 * L'en-tête de la feuille : ce que la carte MONTRAIT, que le voile vient de
 * recouvrir — son image dans sa forme, son titre, sa ligne de contexte. Lu sur
 * l'item de la CARTE, pas sur la fiche complète : ce qu'apporte une carte
 * regroupée des « Derniers ajouts » (« Nouvelle saison », ou le lot « +N » que
 * fabrique `groupLatestByRuns` face à un serveur ancien) n'est pas sur la fiche.
 *
 * Mêmes règles que les légendes des cartes : une AFFICHE d'épisode est le
 * visage de sa série, une VIGNETTE porte le nom de l'épisode.
 */

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Les images à l'échelle de l'interface (`imagePixels`) : le double des
 *  points sur l'Apple TV 4K, la taille affichée sur Android TV (1080p) — une
 *  affiche de 156 points de haut, une vignette de 224 de large. */
const POSTER_HEIGHT = imagePixels(156);
const STILL_WIDTH = imagePixels(224);

function tagOf(tag: string | undefined): { tag?: string } {
  return tag ? { tag } : {};
}

export function mediaSheetHeader(
  client: JellyfinClient,
  item: MediaItem,
  shape: SheetHeaderModel["shape"],
  t: Translate,
): SheetHeaderModel {
  const lot = item.RecentlyAddedCount ?? 0;
  const episode = item.Type === "Episode";
  const code = episode && item.ParentIndexNumber != null && item.IndexNumber != null
    ? formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber)
    : null;
  // La ligne de la légende de la carte (modèle partagé), sinon l'année.
  const context = latestAdditionsLine(t, item) ?? (item.ProductionYear ? String(item.ProductionYear) : null);

  if (shape === "landscape") {
    const image = resolveBannerImage(item);
    return {
      shape,
      title: item.Name,
      subtitle: episode ? [item.SeriesName, code].filter(Boolean).join(" · ") || null : context,
      imageUri: image
        ? client.getImageUrl(image.id, image.type, { width: STILL_WIDTH, quality: 80, ...tagOf(image.tag) })
        : undefined,
    };
  }
  const image = resolvePosterImage(item, "series");
  return {
    shape,
    title: episode ? item.SeriesName ?? item.Name : item.Name,
    subtitle: episode && lot <= 1 ? [code, item.Name].filter(Boolean).join(" — ") || null : context,
    imageUri: image
      ? client.getImageUrl(image.id, image.type, { height: POSTER_HEIGHT, quality: 85, ...tagOf(image.tag) })
      : undefined,
  };
}

/** Une recommandation : son affiche Jellyfin quand elle est en bibliothèque, son titre, son année. */
export function recoSheetHeader(client: JellyfinClient, item: RecoRowItem): SheetHeaderModel {
  return {
    shape: "poster",
    title: item.title,
    subtitle: item.year != null ? String(item.year) : null,
    imageUri: item.jellyfinItemId
      ? client.getImageUrl(item.jellyfinItemId, "Primary", { height: POSTER_HEIGHT, quality: 85 })
      : undefined,
  };
}
