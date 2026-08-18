import { memo } from "react";
import { Image, View } from "react-native";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_DETAIL_POSTER, TV_RADIUS, TV_SHADOW } from "@tentacle-tv/theme";

interface TVDetailPosterProps {
  item: MediaItem;
}

/**
 * L'affiche d'en-tête de la fiche — parité `DetailPoster` (web, non substitué
 * sur webOS). Le format suit le TYPE de média :
 *  • film / série / collection → affiche 2:3, largeur 224 ;
 *  • épisode → sa Primary est un still 16:9, largeur 352.
 * Rayon `radius.lg`, liseré discret, ombre `elev-3`. Non focusable : c'est une
 * image, pas une commande.
 */
export const TVDetailPoster = memo(function TVDetailPoster({ item }: TVDetailPosterProps) {
  const client = useJellyfinClient();
  if (item.ImageTags?.Primary == null) return null;

  const isEpisode = item.Type === "Episode";
  const width = isEpisode ? TV_DETAIL_POSTER.largeurEpisode : TV_DETAIL_POSTER.largeurFilm;
  const height = Math.round(isEpisode ? (width * 9) / 16 : (width * 3) / 2);
  const uri = client.getImageUrl(item.Id, "Primary", {
    ...(isEpisode ? { width: 640 } : { height: 500 }),
    quality: 90,
  });

  return (
    <View
      style={{
        width,
        height,
        borderRadius: TV_RADIUS.lg,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.18)",
        overflow: "hidden",
        ...TV_SHADOW.elev3,
      }}
    >
      <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
    </View>
  );
});
