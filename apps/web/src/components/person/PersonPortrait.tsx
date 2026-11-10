import { memo, type CSSProperties } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { ThumbImage } from "../search/SearchThumbs";

/**
 * Le portrait d'une personne, en 2:3, rempli par son image Jellyfin ou par ses
 * initiales sur une encre neutre (le repli des vignettes, `ThumbImage` : jamais
 * un cadre vide). La taille vient du conteneur : la même pièce sert la carte du
 * casting et l'en-tête de la page de la personne.
 *
 * L'image ne clignote pas : sa couleur (`color`, lue dans le blurhash de
 * Jellyfin quand l'appelant l'a) ou l'encre de carte, puis UN fondu.
 */
export const PersonPortrait = memo(function PersonPortrait({
  id,
  name,
  imageTag,
  height,
  className = "",
  style,
  eager = false,
  color,
}: {
  id: string;
  name: string;
  imageTag?: string | null;
  /** Hauteur DEMANDÉE au serveur (px) — deux fois l'affichage pour les écrans denses. */
  height: number;
  className?: string;
  /** La largeur quand elle se calcule (miroir) plutôt qu'en classe. */
  style?: CSSProperties;
  /** L'en-tête de page se charge tout de suite ; les cartes, à l'approche. */
  eager?: boolean;
  /** La couleur d'attente du portrait (`imageColorOf`), quand on la connaît. */
  color?: string | null;
}) {
  const client = useJellyfinClient();
  const url = imageTag
    ? client.getImageUrl(id, "Primary", { height, quality: 85, tag: imageTag })
    : null;

  return (
    <ThumbImage
      url={url}
      label={name}
      color={color}
      eager={eager}
      className={`aspect-[2/3] ${className}`}
      fallbackClassName="text-2xl font-semibold"
      style={style}
    />
  );
});
