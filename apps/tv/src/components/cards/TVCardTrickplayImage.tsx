import { useState } from "react";
import { Image, View } from "react-native";
import type { TrickplayInfo } from "@tentacle-tv/shared";
import { Colors } from "../../theme/colors";

interface TVCardTrickplayImageProps {
  url: string;
  info: TrickplayInfo;
  /** Colonne et rangée de la vignette dans sa planche (indices entiers). */
  col: number;
  row: number;
  /** Largeur RENDUE de la carte, en dp — le crop se calcule en pixels. */
  cardWidth: number;
  /** Rendu quand la planche ne charge pas — la bannière habituelle. */
  fallback: React.ReactNode;
}

/**
 * La vignette de reprise, croppée dans sa planche trickplay — variante RN.
 *
 * Pas de `background-position` en React Native : la planche entière se rend en
 * `Image` absolue, dimensionnée et décalée en dp pour que la case visée couvre
 * la carte (même règle que `object-cover` — l'axe le plus serré colle, l'autre
 * déborde et se rogne au centre). La carte a une largeur CONNUE
 * (`TV_EPISODE_WIDTH`), donc tout se calcule en pixels exacts.
 *
 * La planche (~3200 px) reste sous la limite de texture des appareils bornée
 * ailleurs à 4096 (cf. `useTVTrickplay`), et le cache image natif honore
 * l'`immutable` un an du proxy : une planche déjà vue ne se retélécharge pas.
 */
export function TVCardTrickplayImage({
  url,
  info,
  col,
  row,
  cardWidth,
  fallback,
}: TVCardTrickplayImageProps) {
  const [errored, setErrored] = useState(false);
  if (errored) return <>{fallback}</>;

  const cardHeight = (cardWidth * 9) / 16;
  const scale = Math.max(cardWidth / info.Width, cardHeight / info.Height);
  const thumbWidth = info.Width * scale;
  const thumbHeight = info.Height * scale;

  return (
    <View
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: Colors.bgElevated,
      }}
    >
      <Image
        source={{ uri: url }}
        style={{
          position: "absolute",
          width: thumbWidth * info.TileWidth,
          height: thumbHeight * info.TileHeight,
          left: (cardWidth - thumbWidth) / 2 - col * thumbWidth,
          top: (cardHeight - thumbHeight) / 2 - row * thumbHeight,
        }}
        // `stretch` : les dimensions calculées SONT les bonnes — `cover`
        // recadrerait la planche entière au lieu de la case.
        resizeMode="stretch"
        // Même règle que TVCardImage : pas de fondu Fresco par carte.
        fadeDuration={0}
        onError={() => setErrored(true)}
      />
    </View>
  );
}
