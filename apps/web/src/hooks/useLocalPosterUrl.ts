/**
 * Affiche LOCALE d'un item téléchargé, pour les écrans de chargement du
 * lecteur. `buildPosterUrl` ne sait construire que des URLs Jellyfin
 * distantes : hors ligne elle rend `undefined` (aucun DTO) ou une URL
 * injoignable — l'écran de chargement restait donc noir alors que les images
 * sont sur le disque.
 *
 * Le backdrop prime sur l'affiche : c'est le format large attendu par ces
 * écrans, et pour un épisode il s'agit déjà de la bannière de la SÉRIE (le
 * snapshot l'enregistre ainsi), donc du même rendu qu'en ligne.
 *
 * Les consommateurs (PlayerLoadingScreen, overlays de DesktopPlayer) affichent
 * l'URL sans gestion d'erreur : on SONDE chaque candidat avant de le rendre,
 * plutôt que d'afficher une image cassée.
 */

import { useEffect, useState } from "react";
import { localResourceUrl, useDownloadsRootReady } from "../downloads/localFiles";

/** Première image locale réellement chargeable, ou undefined. */
export function useLocalPosterUrl(
  itemId: string | undefined,
  enabled: boolean,
): string | undefined {
  const rootReady = useDownloadsRootReady();
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    setUrl(undefined);
    if (!enabled || !itemId || !rootReady) return;
    const candidates = [`meta/${itemId}/backdrop.jpg`, `meta/${itemId}/primary.jpg`]
      .map(localResourceUrl)
      .filter((value): value is string => value !== null);
    if (candidates.length === 0) return;

    let cancelled = false;
    const probe = (index: number): void => {
      if (cancelled || index >= candidates.length) return;
      const candidate = candidates[index];
      const image = new Image();
      image.onload = () => {
        if (!cancelled) setUrl(candidate);
      };
      image.onerror = () => probe(index + 1);
      image.src = candidate;
    };
    probe(0);

    return () => {
      cancelled = true;
    };
  }, [itemId, enabled, rootReady]);

  return url;
}
