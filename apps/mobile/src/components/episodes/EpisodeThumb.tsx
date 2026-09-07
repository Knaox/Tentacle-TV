import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  ep: MediaItem;
  seriesId: string;
  client: ReturnType<typeof useJellyfinClient>;
}

/** La vignette d'un épisode : son image, sinon la bannière de la série, sinon son numéro. */
export function EpisodeThumb({ ep, seriesId, client }: Props) {
  const st = useThemedStyles(makeStyles);
  const hasPrimary = !!ep.ImageTags?.Primary;
  const thumbUrl = hasPrimary
    ? client.getImageUrl(ep.Id, "Primary", { width: 300, quality: 70 })
    : client.getImageUrl(seriesId, "Backdrop", { width: 300, quality: 70 });
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <View style={st.fallback}>
        <Text style={st.fallbackText}>
          {ep.IndexNumber != null ? `E${ep.IndexNumber}` : ep.Name?.charAt(0).toUpperCase() ?? "?"}
        </Text>
      </View>
    );
  }

  return <Image source={{ uri: thumbUrl }} style={st.image} contentFit="cover" onError={() => setImgError(true)} />;
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    image: { width: "100%", height: "100%" },
    fallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surface.s2 },
    fallbackText: { fontSize: 18, fontWeight: "700", color: t.colors.text.tertiary },
  });
