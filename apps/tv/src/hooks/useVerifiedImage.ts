import { useEffect, useState } from "react";
import { Image } from "react-native";

/**
 * Une image qu'on ne montre que si elle existe. Un portrait Jellyfin absent
 * répond 404 : affiché tel quel, il laisserait un cercle vide là où l'initiale
 * du compte devait paraître. L'image est préchargée ; l'adresse n'est rendue
 * qu'une fois le chargement réussi (et reste en cache pour l'affichage).
 */
export function useVerifiedImage(url: string | null | undefined): string | undefined {
  const [verified, setVerified] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    Image.prefetch(url).then(
      (ok) => { if (alive && ok) setVerified(url); },
      () => { /* absente ou injoignable : on garde le repli */ },
    );
    return () => { alive = false; };
  }, [url]);
  return url && verified === url ? url : undefined;
}
