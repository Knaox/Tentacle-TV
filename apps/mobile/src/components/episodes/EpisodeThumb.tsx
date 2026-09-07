import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { useJellyfinClient } from "@tentacle-tv/api-client";
import { resolveBannerImage, type MediaItem } from "@tentacle-tv/shared";
import { useResilientImage } from "@/hooks/useResilientImage";
import { useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  ep: MediaItem;
  seriesId: string;
  client: ReturnType<typeof useJellyfinClient>;
}

/** La vignette d'un épisode : son image, sinon la bannière de la série, sinon son numéro. */
export function EpisodeThumb({ ep, seriesId, client }: Props) {
  const st = useThemedStyles(makeStyles);
  // Chaîne 16:9 du web et de la TV : image de l'épisode, backdrop propre,
  // backdrop du parent, affiche de la série. L'ancien repli visait le backdrop
  // de la série sans vérifier qu'elle en avait un.
  const resolved = resolveBannerImage(ep);
  const thumbUrl = resolved
    ? client.getImageUrl(resolved.id, resolved.type, {
        width: 300,
        quality: 70,
        ...(resolved.tag ? { tag: resolved.tag } : {}),
      })
    : client.getImageUrl(seriesId, "Backdrop", { width: 300, quality: 70 });
  const image = useResilientImage(thumbUrl);
  const uri = image.uri;

  if (uri === null) {
    return (
      <View style={st.fallback}>
        <Text style={st.fallbackText}>
          {ep.IndexNumber != null ? `E${ep.IndexNumber}` : ep.Name?.charAt(0).toUpperCase() ?? "?"}
        </Text>
      </View>
    );
  }

  return (
    <Image source={{ uri }} style={st.image} contentFit="cover" onError={image.onError} recyclingKey={uri} />
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    image: { width: "100%", height: "100%" },
    fallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surface.s2 },
    fallbackText: { fontSize: 18, fontWeight: "700", color: t.colors.text.tertiary },
  });
