import { memo, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { cardRatingFor, formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardFrame } from "./CardFrame";
import { CardImage } from "./CardImage";
import { CardProgressBar } from "./CardProgressBar";
import { CardMarkerLayer } from "./CardMarkerLayer";
import { CardHoverOverlay } from "./CardHoverOverlay";
import { prefetchDetailRoute } from "./prefetchDetail";
import { useCardContextMenu } from "./useCardContextMenu";
import { MediaContextMenu } from "../MediaContextMenu";
import { captureDetailOrigin } from "../detail/detailTransition";
import { resolveBannerImage } from "@tentacle-tv/shared";
import { CardTrickplayImage } from "./CardTrickplayImage";
import { EPISODE_VW, EPISODE_WIDTH, type CardSize } from "./cardSizes";
import { cardWidthStyle } from "./cardWidthStyle";
import { useHoverGuard } from "../../hooks/useHoverGuard";
import { useMountWhile } from "../../hooks/useMountWhile";
import { useResumeFrame } from "../../hooks/useResumeFrame";

interface EpisodeCardProps {
  item: MediaItem;
  index: number;
  size?: CardSize;
  /**
   * Largeur imposée par la rangée, en pixels, pour qu'un nombre entier de
   * cartes la remplisse exactement (`useRowCardWidth`). Absente hors rangée :
   * on retombe alors sur le `clamp` responsive.
   */
  width?: number | null;
  /**
   * Décalage de la cascade d'entrée, en ms. `null` = pas d'animation.
   * Accordé par la rangée à sa PREMIÈRE fenêtre seulement (cf. `PosterCard`).
   */
  entranceDelay?: number | null;
  /** Signale à la rangée quelle carte est survolée, pour l'épingler dans sa fenêtre. */
  onHoverIndex?: (index: number | null) => void;
}

/**
 * Vignette 16:9 des rangées « Reprendre », « Prochains épisodes » et « Déjà
 * vu ». Même cadre que l'affiche 2:3 (`CardFrame`) : élévation et lift, avec
 * une amplitude réduite, la carte étant plus large.
 *
 * Le clic lance la lecture. Au survol, le survol UNIQUE des cartes, variante
 * paysage (`CardHoverOverlay`) : puces qualité/langues en haut à gauche,
 * étoiles et plateau au coin bas-droit — la fiche y a son bouton. Aucun
 * bouton de lecture : la vignette entière EST la lecture. Un panneau d'aperçu flottant, agrandi en portail avec un tiroir de
 * synopsis, a vécu ici : c'était un quatrième survol, différent de tous les
 * autres, retiré pour que toutes les cartes parlent la même langue.
 *
 * `memo` pour la même raison que `PosterCard` : la rangée est fenêtrée et se
 * re-rend à chaque carte franchie.
 */
export const EpisodeCard = memo(function EpisodeCard({
  item,
  index,
  size = "md",
  width,
  entranceDelay = null,
  onHoverIndex,
}: EpisodeCardProps) {
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const ctx = useCardContextMenu();
  // Survol coupé dès que la carte glisse hors du curseur pendant un défilement
  // (cf. `useHoverGuard`).
  const unhover = useCallback(() => setHovered(false), []);
  useHoverGuard(rootRef, hovered, unhover);
  /**
   * Le survol est MONTÉ à la demande, jamais laissé à `opacity: 0` : il
   * porte des abonnements au cache — vu/favori/liste, notes, file hors
   * ligne, droits — que chaque vignette de « Reprendre » garderait au repos.
   * 200 ms = la durée de ses fondus de sortie.
   */
  const overlayMounted = useMountWhile(hovered, 200);

  const isEpisode = item.Type === "Episode";
  // La vignette EXACTE de la reprise, croppée dans sa planche trickplay —
  // `null` hors reprise (position nulle, pas de manifeste, mode économie), et
  // la carte garde alors sa bannière. La bannière reste le repli d'erreur : en
  // pratique elle n'est demandée que si la planche ne charge pas.
  const resumeFrame = useResumeFrame(item);
  const resolvedImage = resolveBannerImage(item);
  // « » : la donnée prouve qu'il n'y a pas d'image — `CardImage` rend son
  // repli sans lancer une requête vouée au 404 (cf. `cardImage.ts` (shared)).
  const imageUrl = resolvedImage
    ? client.getImageUrl(resolvedImage.id, resolvedImage.type, {
        width: 720,
        quality: 80,
        ...(resolvedImage.tag ? { tag: resolvedImage.tag } : {}),
      })
    : "";

  const watched = item.UserData?.Played === true;
  const progress = item.UserData?.PlayedPercentage;
  const widths = EPISODE_WIDTH[size];
  const runtime = formatDuration(item.RunTimeTicks);

  const epLabel = isEpisode
    ? formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber, { style: "padded" })
    : null;
  const seriesName = isEpisode ? item.SeriesName : item.Name;
  const episodeName = isEpisode ? item.Name : null;

  const handleClick = () => {
    if (ctx.ctxMenu) return;
    navigate(`/watch/${item.Id}`);
  };
  const handlePlay = () => navigate(`/watch/${item.Id}`);
  // La fiche s'ouvre depuis la VIGNETTE — la racine embarquerait le bloc
  // titre, et le visuel partirait recadré (cf. `captureDetailOrigin`).
  const openDetails = () => {
    captureDetailOrigin(rootRef.current?.querySelector<HTMLElement>("[data-card-visual]") ?? null, item.Id, imageUrl);
    navigate(`/media/${item.Id}`);
  };

  return (
    <div
      ref={rootRef}
      // `snap-start` : point d'accroche de la rangée (cf. `MediaRow`). C'est ce
      // qui fait qu'un défilement s'arrête sur une carte entière plutôt qu'au
      // milieu de l'une d'elles.
      className="group/card row-dim-card relative flex-shrink-0 cursor-pointer snap-start"
      style={{
        width: cardWidthStyle(width, widths, EPISODE_VW),
        animation: entranceDelay == null ? undefined : "fadeSlideUp 0.34s ease both",
        animationDelay: entranceDelay == null ? undefined : `${entranceDelay}ms`,
        // Au-dessus des voisines pendant le survol : sans cela l'ombre
        // d'élévation est recouverte par la carte suivante (cf. `PosterCard`).
        zIndex: hovered ? 2 : undefined,
      }}
      onMouseEnter={() => {
        setHovered(true);
        onHoverIndex?.(index);
        prefetchDetailRoute();
      }}
      onMouseLeave={() => { setHovered(false); onHoverIndex?.(null); }}
      onClick={handleClick}
      {...ctx.contextHandlers}
    >
      <CardFrame
        hovered={hovered}
        aspect="aspect-video"
        // Amplitude plus faible que l'affiche : la vignette est bien plus large,
        // et le débord latéral vaut `width × (échelle − 1) / 2`. À 1920 px elle
        // fait ~443 px, donc 8,9 px de débord par côté — il reste 3,1 px dans la
        // gouttière de 12 px. `1.045` n'en laisserait que 2 : c'est le plafond.
        lift={{ scale: 1.04, y: -7 }}
      >
        {resumeFrame ? (
          <CardTrickplayImage
            frame={resumeFrame}
            alt={item.Name}
            fallback={<CardImage src={imageUrl} alt={item.Name} />}
          />
        ) : (
          <CardImage src={imageUrl} alt={item.Name} />
        )}

        {/* Scrim + libellé d'épisode posés SUR la vignette : blanc/noir
            constants dans les deux thèmes (règle « posé sur média »). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: "var(--card-reveal-scrim)" }}
        />

        {/* La note de CET épisode — portée `item` : la vignette porte son nom et
            son numéro, elle porte donc sa note, jamais celle de la série. En
            HAUT à gauche : le bas est déjà pris par le code d'épisode et son
            titre. La pastille d'états tient le coin opposé. Les deux s'effacent
            au survol (focus sur téléviseur) : les puces qualité/langues montent
            au même coin, et le plateau reprend les états. */}
        <CardMarkerLayer
          item={item}
          communityRating={cardRatingFor(item, "item").rating}
          scope="item"
          hideRating={hovered}
          hideStatus={hovered}
          ratingClassName="left-2 top-2"
        />

        {/* Le coin bas-droit appartient au groupe du survol (étoiles et
            plateau) : le titre se resserre à sa gauche le temps du survol, au
            lieu de passer dessous. Au-dessus du voile (z-30) pour rester
            lisible, et transparent au pointeur pour ne rien voler au plateau. */}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-1.5 z-30 pl-3 text-on-media-primary ${
            hovered ? "pr-[11.5rem]" : "pr-28"
          }`}
        >
          {epLabel && (
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-media-secondary">
              {epLabel}
            </p>
          )}
          {episodeName && <p className="line-clamp-1 text-xs font-semibold">{episodeName}</p>}
        </div>

        {/* Le survol unique des cartes, variante paysage. Le clic sur la
            vignette lance la lecture : la fiche passe par le plateau. */}
        {overlayMounted && (
          <CardHoverOverlay
            variant="landscape"
            item={item}
            title={isEpisode ? `${seriesName ?? ""} — ${item.Name}` : item.Name}
            visible={hovered}
            play={{ resume: progress != null && progress > 0 && !watched, onPlay: handlePlay }}
            meta={item}
            onOpenDetails={openDetails}
          />
        )}

        {/* La progression reste lisible au-dessus du voile : c'est au survol
            qu'on décide de reprendre (même règle que `PosterTile`). */}
        {!watched && (
          <div className="absolute inset-x-0 bottom-0 z-30">
            <CardProgressBar percent={progress} border />
          </div>
        )}
      </CardFrame>

      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-sm font-semibold tracking-tight text-content-primary">{seriesName}</h3>
        {runtime && <p className="mt-0.5 text-xs text-content-quaternary">{runtime}</p>}
      </div>

      {ctx.ctxMenu && (
        <MediaContextMenu
          item={item}
          x={ctx.ctxMenu.x}
          y={ctx.ctxMenu.y}
          onClose={ctx.closeCtxMenu}
        />
      )}
    </div>
  );
});
