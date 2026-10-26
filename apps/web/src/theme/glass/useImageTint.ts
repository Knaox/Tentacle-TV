/**
 * Le fond ambiant — les deux teintes d'une image, lues UNE fois par adresse :
 * l'image (déjà en cache du navigateur le plus souvent) réduite à 24 × 16 dans
 * un canevas hors document, mémoire bornée. Une image d'un autre hôte qui
 * refuse la lecture de ses pixels (CORS), absente ou sans couleur : `null`, et
 * le fond garde nos couleurs. Hors du mode natif, rien n'est lu.
 */

import { useEffect, useState } from "react";
import { ambientTintsFromPixels } from "./ambientTint";
import { useLiquidGlassMode } from "../useLiquidGlass";

const WIDTH = 24;
const HEIGHT = 16;
const MAX_ENTRIES = 48;
type Tints = readonly [string, string] | null;
const cache = new Map<string, Tints>();

function remember(src: string, tints: Tints): void {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(src, tints);
}

function readTints(image: HTMLImageElement): Tints {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, WIDTH, HEIGHT);
    return ambientTintsFromPixels(context.getImageData(0, 0, WIDTH, HEIGHT).data, WIDTH, HEIGHT);
  } catch {
    // Canevas « teinté » : l'hôte de l'image n'autorise pas la lecture de ses pixels.
    return null;
  }
}

/** Les deux teintes (« r, g, b ») de l'image `src`, ou `null` (pas encore lue, sans couleur, refusée). */
export function useImageTint(src: string | null | undefined): Tints {
  const native = useLiquidGlassMode() === "native";
  const key = native && src ? src : null;
  const [read, setRead] = useState<{ src: string; tints: Tints } | null>(null);

  useEffect(() => {
    if (key === null || cache.has(key)) return;
    let alive = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      const tints = readTints(image);
      remember(key, tints);
      if (alive) setRead({ src: key, tints });
    };
    image.onerror = () => {
      remember(key, null);
      if (alive) setRead({ src: key, tints: null });
    };
    image.src = key;
    return () => {
      alive = false;
    };
  }, [key]);

  if (key === null) return null;
  if (cache.has(key)) return cache.get(key) ?? null;
  return read?.src === key ? read.tints : null;
}
