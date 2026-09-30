import { useEffect, useState } from "react";
import { Image } from "react-native";

/**
 * Les adresses déjà vérifiées, pour la vie de l'app : un écran monté plus
 * tard (la navigation de chaque écran refondu) montre l'image d'emblée, sans
 * passer un instant par son repli.
 */
const verifiedUrls = new Set<string>();

/**
 * Une image qu'on ne montre que si elle existe. Un portrait Jellyfin absent
 * répond 404 : affiché tel quel, il laisserait un cercle vide là où l'initiale
 * du compte devait paraître. L'image est préchargée ; l'adresse n'est rendue
 * qu'une fois le chargement réussi (et reste en cache pour l'affichage).
 */
export function useVerifiedImage(url: string | null | undefined): string | undefined {
  const [verified, setVerified] = useState<string | null>(null);
  const known = !!url && verifiedUrls.has(url);
  useEffect(() => {
    if (!url || verifiedUrls.has(url)) return;
    let alive = true;
    Image.prefetch(url).then(
      (ok) => {
        if (!ok) return;
        verifiedUrls.add(url);
        if (alive) setVerified(url);
      },
      () => { /* absente ou injoignable : on garde le repli */ },
    );
    return () => { alive = false; };
  }, [url]);
  return url && (known || verified === url) ? url : undefined;
}
