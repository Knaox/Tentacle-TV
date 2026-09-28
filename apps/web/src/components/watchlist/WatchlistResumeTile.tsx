import { memo, useRef, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useJellyfinClient, watchProgress } from "@tentacle-tv/api-client";
import { cardRatingFor, resolveBannerImage, type MediaItem } from "@tentacle-tv/shared";
import { CardFrame } from "../cards/CardFrame";
import { CardHoverOverlay } from "../cards/CardHoverOverlay";
import { CardImage } from "../cards/CardImage";
import { CardMarkerLayer } from "../cards/CardMarkerLayer";
import { CardProgressBar } from "../cards/CardProgressBar";
import { useCardHover } from "../cards/useCardHover";
import { captureDetailOrigin } from "../detail/detailTransition";
import { useMountWhile } from "../../hooks/useMountWhile";
import { useRemainingLabel } from "./WatchProgressLine";

interface WatchlistResumeTileProps {
  item: MediaItem;
  onPlay: (item: MediaItem) => void;
  /** La cible de lecture se résout (série) : la tuile attend. */
  pending: boolean;
}

/**
 * Une vignette 16:9 de « Reprendre », dans Ma liste. Toucher la vignette
 * LANCE la lecture — c'est la seule promesse de cette rangée.
 *
 * C'est la carte paysage de toutes les rangées : même cadre, mêmes marqueurs
 * au repos, et au survol la variante `landscape` du survol unique (étoiles et
 * plateau au coin bas-droit, la fiche dans le plateau, aucun bouton de
 * lecture : la vignette entière lit). Elle avait son propre dessin : un
 * bouton blanc permanent dans l'angle et une barre de progression recopiée.
 */
export const WatchlistResumeTile = memo(function WatchlistResumeTile({ item, onPlay, pending }: WatchlistResumeTileProps) {
  const { t } = useTranslation("watchlist");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const hover = useCardHover(rootRef);
  // Monté au survol seulement, jamais laissé à `opacity: 0` (règle GPU du dépôt).
  const overlayMounted = useMountWhile(hover.hovered, 200);
  const remainingLabel = useRemainingLabel();
  const image = resolveBannerImage(item);
  const imageUrl = image
    ? client.getImageUrl(image.id, image.type, { width: 640, quality: 80, ...(image.tag ? { tag: image.tag } : {}) })
    : "";
  const percent = watchProgress(item);
  const remaining = remainingLabel(item);
  const label = `${t("resume")} — ${item.Name}${remaining ? `, ${remaining}` : ""}`;

  const play = (e?: MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!pending) onPlay(item);
  };
  const openDetails = () => {
    captureDetailOrigin(rootRef.current?.querySelector<HTMLElement>("[data-card-visual]") ?? null, item.Id, imageUrl);
    navigate(`/media/${item.Id}`);
  };

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-busy={pending}
      onClick={() => play()}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        play();
      }}
      {...hover.handlers}
      // L'anneau de focus est dessiné par la vignette (`CardFrame`), qui se soulève.
      className={`group/card group/focus relative block w-[240px] text-left outline-none sm:w-[300px] ${
        pending ? "cursor-wait" : "cursor-pointer"
      }`}
      style={{ zIndex: hover.hovered ? 2 : undefined }}
    >
      <CardFrame hovered={hover.hovered} aspect="aspect-video" lift={{ scale: 1.04, y: -7 }}>
        <CardImage src={imageUrl} alt="" />
        {/* Voile constant dans les deux thèmes : le texte est posé sur l'image. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        <CardMarkerLayer
          item={item}
          communityRating={cardRatingFor(item, "series").rating}
          hideRating={hover.hovered}
          hideStatus={hover.hovered}
          ratingClassName="left-2 top-2"
        />

        {/* Titre et reste à voir, au-dessus du voile ; ils se resserrent à
            gauche du groupe du survol (étoiles et plateau, coin bas-droit). */}
        <div className={`pointer-events-none absolute inset-x-0 bottom-3 z-30 pl-3 ${hover.hovered ? "pr-[11.5rem]" : "pr-3"}`}>
          <span className="block truncate text-sm font-semibold text-white drop-shadow">{item.Name}</span>
          {remaining && <span className="mt-0.5 block truncate text-xs text-white/75">{remaining}</span>}
        </div>

        {overlayMounted && (
          <CardHoverOverlay
            variant="landscape"
            item={item}
            title={item.Name}
            visible={hover.hovered}
            play={{ resume: true, onPlay: play }}
            meta={item}
            onOpenDetails={openDetails}
          />
        )}

        {pending && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/40">
            <Loader2 size={22} className="animate-spin text-white" />
          </div>
        )}

        {percent != null && percent < 100 && (
          <div className="absolute inset-x-0 bottom-0 z-30">
            <CardProgressBar percent={percent} />
          </div>
        )}
      </CardFrame>
    </div>
  );
});
