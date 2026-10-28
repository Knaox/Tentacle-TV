/**
 * Octave (mobile) — tant que le lecteur plein écran est ouvert, les pochettes du titre d'avant et d'après
 * (`artworkNeighbours`) sont préparées en fond, en grand et en vignette du fond vivant : balayée, la suivante
 * s'affiche aussitôt, sans attendre le réseau ni le décodage pendant qu'elle entre.
 */

import { useEffect } from "react";
import { Image } from "expo-image";
import { elementSourceUrl } from "@tentacle-tv/shared/octave";
import { useMobileEngineAuth } from "../audio/useMobileEngineAuth";
import { ambientArtworkUrl } from "./ambient/ambientMotion";
import { neighbourArtworkUrls } from "./artworkNeighbours";
import { usePlayerSelector } from "./OctavePlayerContext";

export function useNeighbourArtworkPrefetch(): void {
  const auth = useMobileEngineAuth();
  // Une chaîne : le sélecteur ne redessine rien tant que les voisines ne changent pas.
  const neighbours = usePlayerSelector((s) => neighbourArtworkUrls(s.queue).join("\n"));
  useEffect(() => {
    if (neighbours === "") return;
    const uris = neighbours.split("\n").flatMap((url) => [url, ambientArtworkUrl(url)])
      .filter((url): url is string => url !== null)
      .map((url) => elementSourceUrl(url, auth));
    void Image.prefetch(uris, "memory-disk").catch(() => undefined);
  }, [neighbours, auth]);
}
