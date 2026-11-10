import { useState } from "react";
import { isImageReady, markImageSeen } from "../../lib/seenImages";

interface BannerArtProps {
  url: string;
  /** L'image n'a pas pu se charger : elle se retire, la couleur et les voiles restent. */
  broken: boolean;
  onError: () => void;
}

/**
 * Le décor d'une bannière de catalogue (bibliothèque, Ma liste, Mes favoris) : UN fondu
 * d'opacité de 220 ms sur la couleur de l'image, posée dessous par l'appelant — plus de dézoom
 * de 0,7 s rejoué à chaque visite. Déjà montrée pendant la séance (`lib/seenImages`), elle est
 * là d'emblée, sans fondu : revenir d'une fiche ne repart jamais du noir.
 *
 * Une balise `<img>` NUE, enfant direct de la boîte image : la feuille du client LG la vise
 * par `.-bottom-[200px] > img` (`library-tv.css`). L'état est lu au montage — l'appelant donne
 * une `key` par image.
 */
export function BannerArt({ url, broken, onError }: BannerArtProps) {
  const [instant] = useState(() => isImageReady(url));
  const [loaded, setLoaded] = useState(instant);

  return (
    <img
      src={url}
      alt=""
      draggable={false}
      className={`absolute inset-0 h-full w-full object-cover ${instant ? "" : "transition-opacity duration-card ease-out"} ${loaded ? "opacity-100" : "opacity-0"}`}
      style={{ display: broken ? "none" : undefined }}
      onLoad={() => { markImageSeen(url); setLoaded(true); }}
      onError={onError}
    />
  );
}
