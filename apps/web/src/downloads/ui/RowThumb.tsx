/**
 * La vignette 16:9 d'une ligne de la file : l'image du titre lue sur le disque (premier
 * candidat qui charge, puis le suivant), sinon un repère — jamais un rectangle vide. Les à-côtés
 * d'un transfert arrivent APRÈS le média : pendant qu'il court, l'image peut manquer.
 */

import { useEffect, useState } from "react";
import { FilmStripIcon } from "@phosphor-icons/react/dist/csr/FilmStrip";
import { localResourceUrl, useDownloadsRootReady } from "../localFiles";

/** Un épisode : sa vignette ; un film : son décor (l'affiche 2:3 se rognerait mal). */
const EPISODE_ART = ["primary.jpg", "backdrop.jpg"] as const;
const MOVIE_ART = ["backdrop.jpg", "primary.jpg"] as const;

export function RowThumb({ itemId, episode }: { itemId: string; episode: boolean }) {
  const rootReady = useDownloadsRootReady();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [itemId]);
  const name = (episode ? EPISODE_ART : MOVIE_ART)[attempt];
  const url = rootReady && name ? localResourceUrl(`meta/${itemId}/${name}`) : null;

  return (
    <div className="relative flex h-[52px] w-[92px] flex-shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-surface-2 text-content-quaternary">
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setAttempt((n) => n + 1)}
        />
      ) : (
        <FilmStripIcon size={18} aria-hidden />
      )}
    </div>
  );
}
