/**
 * Une carte de la grille de résultats de recherche.
 *
 * Extraite de `SearchOverlay` pour lui rendre de la place : elle a désormais un
 * état de survol et un bouton de téléchargement.
 */

import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { captureDetailOrigin } from "../detail/detailTransition";
import { useBrokenImage } from "../../hooks/useBrokenImage";
import { useHoverMount } from "../../hooks/useHoverMount";
import { CardDownloadAction } from "../../downloads/CardDownloadAction";

export function SearchResultCard({
  item,
  index,
  onSelect,
}: {
  item: MediaItem;
  index: number;
  onSelect: (it: MediaItem) => void;
}) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const visualRef = useRef<HTMLDivElement>(null);
  const isEpisode = item.Type === "Episode";
  const imageId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const imageUrl = client.getImageUrl(imageId, "Primary", { height: 360, quality: 85 });
  const { broken, reportFailure } = useBrokenImage(imageUrl);
  // Ici la carte EST un bouton : le clavier l'atteint. On branche donc le
  // survol sur le focus aussi — c'est la seule grille de l'app où le
  // téléchargement devient accessible sans souris.
  const hover = useHoverMount(150);
  const type =
    item.Type === "Movie" ? t("common:movie") :
    item.Type === "Series" ? t("common:series") :
    item.Type;

  const handleClick = () => {
    // La recherche était le SEUL chemin vers une fiche à ne rien capturer :
    // toutes les cartes de l'app le font (cf. `PosterCard`, `LibraryGridCard`),
    // la grille de résultats non. La fiche s'ouvrait donc sans son calque, et
    // il ne restait que le fondu de page par-dessus une fiche encore en
    // chargement — le « rien ne se passe, puis ça apparaît » observé ici.
    //
    // Le visuel seul, pas le bouton : celui-ci embarque les deux lignes de
    // texte sous l'affiche. Rayon 6 px = le `rounded-md` ci-dessous ; le défaut
    // de 12 ferait sauter le coin au départ.
    captureDetailOrigin(visualRef.current, item.Id, imageUrl, 6, true);
    onSelect(item);
  };

  return (
    <li
      className="relative"
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
      onFocus={hover.onMouseEnter}
      onBlur={hover.onMouseLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        className="group/r block w-full text-left"
        style={{
          animation: "fadeSlideUp 0.4s ease both",
          animationDelay: `${Math.min(index * 30, 300)}ms`,
        }}
      >
        <div ref={visualRef} className="relative aspect-[2/3] overflow-hidden rounded-md bg-surface-1">
          <img
            src={imageUrl}
            alt={item.Name}
            loading="lazy" decoding="async"
            draggable={false}
            className="h-full w-full object-cover transition-transform duration-300 group-hover/r:scale-105"
            style={{ display: broken ? "none" : undefined }}
            onError={reportFailure}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
        </div>
        <p className="mt-2 truncate text-sm font-medium text-content-primary">{item.Name}</p>
        <p className="text-xs text-content-quaternary">
          {type}
          {item.ProductionYear ? ` · ${item.ProductionYear}` : ""}
        </p>
      </button>
      {/* FRÈRE du bouton de carte, jamais enfant : un <button> dans un <button>
          est invalide, et le navigateur défait alors l'imbrication en silence.
          Posé sur l'affiche, qui occupe toute la largeur en haut de la carte. */}
      {hover.mounted && (
        <div
          className="hover-reveal absolute right-2 top-2 z-10"
          data-shown={hover.hovered}
          style={{
            pointerEvents: hover.hovered ? "auto" : "none",
            "--reveal-ms": "150ms",
          } as React.CSSProperties}
        >
          <CardDownloadAction item={item} variant="compact" />
        </div>
      )}
    </li>
  );
}
