/**
 * Octave — la teinte de la pochette en cours, pour l'eau du lecteur plein
 * écran. Une vignette de 64 px (la taille la plus petite de la route du cœur),
 * réduite à 24 × 24 dans un canevas hors document, UNE fois par pochette
 * (mémoire bornée). Une image d'un autre hôte qui refuse la lecture de ses
 * pixels (CORS), une pochette absente ou sans couleur : `null`, et l'eau garde
 * le rose d'Octave.
 */

import { useEffect, useState } from "react";
import { useArtworkResolver } from "../components/Artwork";
import { sizedArtworkUrl } from "../components/artworkTone";
import { rgbTriplet, tintFromPixels } from "./artworkTint";

const SAMPLE = 24;
const MAX_ENTRIES = 48;
const tints = new Map<string, string | null>();

function remember(src: string, tint: string | null): void {
  if (tints.size >= MAX_ENTRIES) tints.delete(tints.keys().next().value as string);
  tints.set(src, tint);
}

function readTint(image: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE;
    canvas.height = SAMPLE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, SAMPLE, SAMPLE);
    const tint = tintFromPixels(context.getImageData(0, 0, SAMPLE, SAMPLE).data);
    return tint ? rgbTriplet(tint) : null;
  } catch {
    // Canevas « teinté » : l'hôte de l'image n'autorise pas la lecture de ses pixels.
    return null;
  }
}

/** La teinte (« r, g, b ») de la pochette, ou `null` tant qu'elle n'est pas lue, ou sans teinte. */
export function useArtworkTint(url: string | null): string | null {
  const resolve = useArtworkResolver();
  const src = url === null ? null : resolve(sizedArtworkUrl(url, 64));
  const [tint, setTint] = useState<{ src: string; value: string | null } | null>(null);

  useEffect(() => {
    if (src === null || tints.has(src)) return;
    let alive = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      const value = readTint(image);
      remember(src, value);
      if (alive) setTint({ src, value });
    };
    image.onerror = () => {
      remember(src, null);
      if (alive) setTint({ src, value: null });
    };
    image.src = src;
    return () => {
      alive = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [src]);

  if (src === null) return null;
  if (tints.has(src)) return tints.get(src) ?? null;
  return tint?.src === src ? tint.value : null;
}
