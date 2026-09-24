/**
 * Les vignettes des résultats de recherche — affiche d'un titre, image d'un
 * épisode, portrait d'une personne — adressées par leur TAG quand le moteur
 * l'a (image servie du cache, jamais redemandée), avec un repli dessiné en
 * jetons quand l'image manque ou casse : jamais un carré vide.
 */

import { memo } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { initials, type SearchMediaItem, type SearchPersonHit } from "@tentacle-tv/shared";
import { useBrokenImage } from "../../hooks/useBrokenImage";

const FALLBACK = "linear-gradient(160deg, rgba(var(--brand-rgb), 0.45) 0%, var(--fill-strong) 100%)";

export const PosterThumb = memo(function PosterThumb({
  item,
  height,
  className,
}: {
  item: SearchMediaItem;
  /** Hauteur demandée au serveur, en pixels réels. */
  height: number;
  className: string;
}) {
  const client = useJellyfinClient();
  const tag = item.ImageTags?.["Primary"];
  // Un épisode sans image propre prend l'affiche de sa série.
  const url = tag
    ? client.getImageUrl(item.Id, "Primary", { height, quality: 85, tag })
    : item.SeriesId && item.SeriesPrimaryImageTag
      ? client.getImageUrl(item.SeriesId, "Primary", { height, quality: 85, tag: item.SeriesPrimaryImageTag })
      : null;
  const { broken, reportFailure } = useBrokenImage(url);
  return (
    <div className={`relative shrink-0 overflow-hidden bg-surface-2 ${className}`}>
      {url !== null && !broken ? (
        <img src={url} alt="" loading="lazy" decoding="async" draggable={false} onError={reportFailure} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white/80" style={{ background: FALLBACK }}>
          {initials(item.Name)}
        </div>
      )}
    </div>
  );
});

export const PersonAvatar = memo(function PersonAvatar({
  person,
  size,
  className = "",
}: {
  person: Pick<SearchPersonHit, "id" | "name" | "imageTag">;
  size: number;
  className?: string;
}) {
  const client = useJellyfinClient();
  const url = person.imageTag
    ? client.getImageUrl(person.id, "Primary", { height: size * 2, quality: 85, tag: person.imageTag })
    : null;
  const { broken, reportFailure } = useBrokenImage(url);
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line-subtle ${className}`}
      style={{ width: size, height: size }}
    >
      {url !== null && !broken ? (
        <img src={url} alt="" loading="lazy" decoding="async" draggable={false} onError={reportFailure} className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-semibold text-white/90"
          style={{ background: FALLBACK, fontSize: Math.max(11, Math.round(size * 0.36)) }}
        >
          {initials(person.name)}
        </div>
      )}
    </div>
  );
});
