import { useState } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";

/** L'affiche d'un titre de bibliothèque ; une case neutre si elle manque. */
export function AffinityPoster({ itemId, className, width = 240 }: { itemId: string; className: string; width?: number }) {
  const client = useJellyfinClient();
  const [broken, setBroken] = useState(false);
  if (broken) return <div aria-hidden className={`${className} bg-fill-soft`} />;
  return (
    <img
      src={client.getImageUrl(itemId, "Primary", { width, quality: 85 })}
      alt=""
      decoding="async"
      draggable={false}
      onError={() => setBroken(true)}
      className={`${className} bg-fill-soft object-cover`}
    />
  );
}
