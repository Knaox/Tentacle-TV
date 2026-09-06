import { useMemo } from "react";
import type { StyleProp } from "react-native";
import { Image, type ImageContentFit, type ImageStyle } from "expo-image";
import { localExists, metaUri } from "../engineApi";

interface Props {
  itemId: string;
  /** Fichiers du snapshot, dans l'ordre de préférence (`primary.jpg`, `series-primary.jpg`…). */
  candidates: readonly string[];
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  /** Change de valeur pour re-résoudre (après une réparation, par exemple). */
  nonce?: number;
}

/**
 * Un visuel du snapshot local (`file://`), le premier présent parmi les
 * candidats. `cachePolicy="none"` : le fichier peut être remplacé sous le même
 * nom par une re-photographie, et expo-image ne doit pas en garder une copie.
 */
export function OfflineLocalImage({ itemId, candidates, style, contentFit = "cover", nonce }: Props) {
  const uri = useMemo(() => {
    for (const name of candidates) {
      const candidate = metaUri(itemId, name);
      if (localExists(candidate)) return candidate;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `nonce` force la re-résolution
  }, [itemId, candidates.join("|"), nonce]);
  if (uri === null) return null;
  return <Image source={{ uri }} style={style} contentFit={contentFit} cachePolicy="none" transition={150} />;
}
