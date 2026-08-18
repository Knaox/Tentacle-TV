import { memo, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_BANNER_CARD } from "@tentacle-tv/theme";
import { Colors } from "../../theme/colors";

interface TVHeroBackdropProps {
  current: MediaItem;
  /** Appelé quand le fondu vers `current` est terminé (image arrivée). */
  onSettled?: () => void;
}

/** L'URL de backdrop d'un item — un épisode emprunte celui de sa série. */
export function backdropUriOf(
  client: ReturnType<typeof useJellyfinClient>,
  item: MediaItem,
  width = 1920,
  quality = 85,
): string {
  const id = item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id;
  return client.getImageUrl(id, "Backdrop", { width, quality });
}

/**
 * Le fond de la carte bannière — parité `banniere-tv-fondu` (webOS).
 *
 * L'image est KEYÉE sur son URL : changer de mise en avant démonte l'ancienne
 * et monte un élément neuf, qui entre en fondu d'opacité (700 ms) une fois
 * chargé. À aucun moment deux images plein cadre ne sont composées ensemble —
 * l'ancien double-buffer payait ce moment-là à chaque rotation. Les backdrops
 * étant préchargés par le billboard, le trou entre démontage et chargement est
 * imperceptible.
 *
 * Le Ken Burns a été retiré : la référence webOS n'en a pas, et une animation
 * infinie sur une image plein cadre est exactement ce que la règle GPU du
 * dépôt proscrit.
 */
export const TVHeroBackdrop = memo(function TVHeroBackdrop({
  current,
  onSettled,
}: TVHeroBackdropProps) {
  const client = useJellyfinClient();
  const uri = backdropUriOf(client, current);

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <FadingBackdrop key={uri} uri={uri} onSettled={onSettled} />

      {/* Estompage bas, vers le fond de page (lisibilité de la 1re rangée). */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.55)", Colors.bgDeep]}
        locations={[0, 0.55, 1]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "60%" }}
      />

      {/* Voile horizontal gauche, sous le bloc texte. */}
      <LinearGradient
        colors={[Colors.bgDeep, "rgba(0,0,0,0.55)", "transparent"]}
        locations={[0, 0.32, 0.72]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "60%" }}
      />
    </View>
  );
});

/** Une image qui joue son fondu d'entrée puis ne bouge plus. */
function FadingBackdrop({ uri, onSettled }: { uri: string; onSettled?: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  return (
    <Animated.Image
      source={{ uri }}
      resizeMode="cover"
      style={{ width: "100%", height: "100%", opacity }}
      onLoad={() => {
        Animated.timing(opacity, {
          toValue: 1,
          duration: TV_BANNER_CARD.fonduMs,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) settledRef.current?.();
        });
      }}
    />
  );
}
