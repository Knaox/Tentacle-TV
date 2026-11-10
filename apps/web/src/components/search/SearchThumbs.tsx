/**
 * Les vignettes des résultats de recherche — affiche d'un titre, image d'un
 * épisode, portrait d'une personne — adressées par leur TAG quand le moteur
 * l'a (image servie du cache, jamais redemandée), avec un repli dessiné en
 * jetons quand l'image manque ou casse : jamais un carré vide.
 *
 * Une image n'y clignote pas (docs/REFONTE-UI.md) : sa couleur — ou l'encre de
 * carte — d'abord, puis UN fondu ; déjà vue pendant la séance, elle est là
 * d'emblée (`lib/seenImages`).
 */

import { memo, useState, type CSSProperties, type ReactNode } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { initials, type SearchMediaItem, type SearchPersonHit } from "@tentacle-tv/shared";
import { useBrokenImage } from "../../hooks/useBrokenImage";
import { markImageSeen, wasImageSeen } from "../../lib/seenImages";

/**
 * L'image à REPLI des vignettes : la boîte `.ui-image` du socle (couleur
 * d'attente, un seul fondu), et les initiales sur une encre neutre quand il
 * n'y a pas d'image ou qu'elle casse. Partagée par les affiches, les
 * portraits et les titres hors bibliothèque.
 */
export const ThumbImage = memo(function ThumbImage({
  url,
  label,
  color,
  eager = false,
  className = "",
  fallbackClassName = "text-[11px] font-bold",
  style,
  children,
}: {
  url: string | null;
  /** Ce dont on tire les initiales du repli. */
  label: string;
  /** La couleur d'attente (`imageColorOf`) ; sans elle, l'encre de carte. */
  color?: string | null;
  eager?: boolean;
  /** La boîte : taille, ratio, rayon. */
  className?: string;
  /** La taille des initiales du repli. */
  fallbackClassName?: string;
  style?: CSSProperties;
  /** Posé SUR l'image : marqueurs, pastille. */
  children?: ReactNode;
}) {
  const { broken, reportFailure } = useBrokenImage(url);
  // L'état suit l'ADRESSE : une autre image repart de zéro, sans effet.
  const [state, setState] = useState(() => ({ url, loaded: wasImageSeen(url), instant: wasImageSeen(url) }));
  if (state.url !== url) setState({ url, loaded: wasImageSeen(url), instant: wasImageSeen(url) });
  const shown = url !== null && !broken;

  return (
    <div className={`ui-image shrink-0 ${className}`} style={color && shown ? { ...style, backgroundColor: color } : style}>
      {shown ? (
        <img
          src={url}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          data-loaded={state.loaded}
          data-instant={state.instant}
          onLoad={() => {
            markImageSeen(url);
            setState((s) => (s.url === url ? { ...s, loaded: true } : s));
          }}
          onError={reportFailure}
        />
      ) : (
        <div aria-hidden className={`flex h-full w-full items-center justify-center bg-surface-3 font-display text-content-tertiary ${fallbackClassName}`}>
          {initials(label)}
        </div>
      )}
      {children}
    </div>
  );
});

export const PosterThumb = memo(function PosterThumb({
  item,
  height,
  className,
  children,
}: {
  item: SearchMediaItem;
  /** Hauteur demandée au serveur, en pixels réels. */
  height: number;
  className: string;
  /** Posé SUR l'image : les marqueurs des cartes (note, états, progression). */
  children?: ReactNode;
}) {
  const client = useJellyfinClient();
  const tag = item.ImageTags?.["Primary"];
  // Un épisode sans image propre prend l'affiche de sa série.
  const url = tag
    ? client.getImageUrl(item.Id, "Primary", { height, quality: 85, tag })
    : item.SeriesId && item.SeriesPrimaryImageTag
      ? client.getImageUrl(item.SeriesId, "Primary", { height, quality: 85, tag: item.SeriesPrimaryImageTag })
      : null;
  return (
    <ThumbImage url={url} label={item.Name} className={className}>
      {children}
    </ThumbImage>
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
  return (
    <ThumbImage
      url={url}
      label={person.name}
      className={`rounded-full ${className}`}
      fallbackClassName="font-semibold"
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) }}
    />
  );
});
