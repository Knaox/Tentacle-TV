import { memo, type CSSProperties } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { initials } from "@tentacle-tv/shared";
import { useBrokenImage } from "../../hooks/useBrokenImage";

/** Le repli des cartes de résultats (`SearchThumbs`) : jamais un cadre vide. */
const FALLBACK = "linear-gradient(160deg, rgba(var(--brand-rgb), 0.45) 0%, var(--fill-strong) 100%)";

/**
 * Le portrait d'une personne, en 2:3, rempli par son image Jellyfin ou par ses
 * initiales sur le dégradé de marque. La taille vient du conteneur : la même
 * pièce sert la carte du casting et l'en-tête de la page de la personne.
 */
export const PersonPortrait = memo(function PersonPortrait({
  id,
  name,
  imageTag,
  height,
  className = "",
  style,
  eager = false,
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
}) {
  const client = useJellyfinClient();
  const url = imageTag
    ? client.getImageUrl(id, "Primary", { height, quality: 85, tag: imageTag })
    : null;
  const { broken, reportFailure } = useBrokenImage(url);

  return (
    <div className={`relative aspect-[2/3] overflow-hidden bg-surface-2 ${className}`} style={style}>
      {url !== null && !broken ? (
        <img
          src={url}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onError={reportFailure}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white/85"
          style={{ background: FALLBACK }}
        >
          {initials(name)}
        </div>
      )}
    </div>
  );
});
