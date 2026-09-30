import { useEffect, useState } from "react";
import { Image } from "react-native";

/**
 * Le rapport largeur / hauteur d'une image, lu une fois puis gardé. Sert au
 * logo d'un titre : on l'aligne à GAUCHE, à sa vraie largeur, au lieu de le
 * centrer dans une boîte trop large.
 */
const cache = new Map<string, number>();

export function useImageAspect(uri: string | undefined, fallback: number): number {
  const [aspect, setAspect] = useState(() => (uri && cache.get(uri)) || fallback);
  useEffect(() => {
    if (!uri) return;
    const known = cache.get(uri);
    if (known) {
      setAspect(known);
      return;
    }
    let alive = true;
    Image.getSize(
      uri,
      (width, height) => {
        if (!height) return;
        cache.set(uri, width / height);
        if (alive) setAspect(width / height);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [uri]);
  return aspect;
}
