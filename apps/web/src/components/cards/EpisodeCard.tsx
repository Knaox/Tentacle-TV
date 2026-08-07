import { memo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardFrame } from "./CardFrame";
import { CardImage } from "./CardImage";
import { CardProgressBar } from "./CardProgressBar";
import { CardQuickActions } from "./CardQuickActions";
import { CardMoreInfoButton } from "./CardMoreInfoButton";
import { CardHoverPreview } from "./CardHoverPreview";
import { useHoverPreview } from "./useHoverPreview";
import { prefetchDetailRoute } from "./prefetchDetail";
import { useCardContextMenu } from "./useCardContextMenu";
import { MediaContextMenu } from "../MediaContextMenu";
import { CardMetaOverlay } from "../media/CardMetaOverlay";
import { resolveBannerImage } from "./resolveCardImage";
import { EPISODE_VW, EPISODE_WIDTH, type CardSize } from "./cardSizes";
import { cardWidthStyle } from "./cardWidthStyle";
import { useHoverGuard } from "../../hooks/useHoverGuard";

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
 * Vignette 16:9 des rangées « Reprendre » et « Prochains épisodes ».
 * Même cadre de survol que l'affiche 2:3 (`CardFrame`) : élévation et lift, avec
 * une amplitude réduite, la carte étant plus large.
 * Le clic lance la lecture ; la fiche détail passe par « Plus d'infos ».
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
  const ctx = useCardContextMenu();
  const preview = useHoverPreview(ctx.ctxMenu !== null);
  // Survol coupé dès que la carte glisse hors du curseur pendant un défilement
  // (cf. `useHoverGuard`). Le panneau, lui, se referme tout seul : il tient déjà
  // sa propre boucle de suivi.
  const unhover = useCallback(() => setHovered(false), []);
  useHoverGuard(preview.anchorRef, hovered, unhover);

  const isEpisode = item.Type === "Episode";
  const { id: imageId, type: imageType } = resolveBannerImage(item);
  const imageUrl = client.getImageUrl(imageId, imageType, { width: 720, quality: 80 });

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

  return (
    <div
      ref={preview.anchorRef}
      // `cursor-pointer` UNIQUEMENT quand la carte est elle-même la cible du
      // clic. Dès que le panneau prend le relais, c'est LUI qui porte les
      // intentions — vignette pour lire, tiroir pour la fiche — et chacune de
      // ses zones affiche son propre curseur. Laisser la main sur la carte
      // dessous laissait croire à une troisième cible cliquable.
      // `snap-start` : point d'accroche de la rangée (cf. `MediaRow`). C'est ce
      // qui fait qu'un défilement s'arrête sur une carte entière plutôt qu'au
      // milieu de l'une d'elles.
      className={`group/card row-dim-card relative flex-shrink-0 snap-start ${preview.panelActive ? "" : "cursor-pointer"}`}
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
        preview.handlers.onMouseEnter();
      }}
      onMouseLeave={() => { setHovered(false); onHoverIndex?.(null); preview.handlers.onMouseLeave(); }}
      onClick={handleClick}
      {...ctx.contextHandlers}
    >
      {/* Le liseré répond dès l'entrée du curseur, mais la carte ne se déplace
          jamais quand un panneau doit prendre le relais : c'est LUI qui porte
          le lift, dans la continuité. Et dès qu'il est ouvert, la carte
          s'efface : il occupe sa place au pixel près, deux calques n'ont plus
          rien à faire l'un sur l'autre. */}
      <CardFrame
        // `&& !preview.open` : sans lui, la carte gardait TOUTE sa pile
        // d'effets vivante sous le panneau — halo flouté en dérive infinie,
        // grain masqué, élévation — alors qu'elle est à `opacity: 0` et que le
        // panneau en monte déjà une seconde. Trois images coexistaient par
        // carte survolée.
        //
        // La cause est subtile : le panneau est portalisé sur `document.body`
        // mais reste enfant REACT de la carte, et React calcule l'ancêtre
        // commun des `mouseleave` dans l'arbre des fibres, en traversant les
        // portails. Le `onMouseLeave` de la racine n'est donc jamais appelé
        // quand le curseur passe de la carte au panneau.
        //
        // Valeur dérivée, surtout pas un `setState` : `hovered` doit continuer
        // de dire « le curseur est là ». Sinon, à la fermeture par Échap, par
        // défilement ou par clic ailleurs, la carte réapparaîtrait non
        // survolée sous le curseur.
        hovered={hovered && !preview.open}
        suppressLift={preview.panelActive}
        concealed={preview.open}
        aspect="aspect-video"
        // Amplitude plus faible que l'affiche : la vignette est bien plus large,
        // et le débord latéral vaut `largeur × (échelle − 1) / 2`. À 1920 px elle
        // fait ~443 px, donc 8,9 px de débord par côté — il reste 3,1 px dans la
        // gouttière de 12 px. `1.045` n'en laisserait que 2 : c'est le plafond.
        lift={{ scale: 1.04, y: -7 }}
      >
        {/* Pas de zoom interne quand le panneau prend le relais : il peindrait
            la même image à un autre cadrage, d'où le recul brutal ressenti à
            l'ouverture. */}
        <CardImage src={imageUrl} alt={item.Name} zoom={!preview.panelActive} />

        {/* Qualité/langues au survol UNIQUEMENT là où il n'y a pas de panneau
            (toucher, petit écran) : sinon elles s'affichaient sur la vignette
            en même temps que le panneau les répétait juste à côté. */}
        {!preview.panelActive && hovered && <CardMetaOverlay item={item} reveal="mount" />}

        {/* Scrim + libellé d'épisode posés SUR la vignette : blanc/noir
            constants dans les deux thèmes (règle « posé sur média »). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: "var(--card-reveal-scrim)" }}
        />

        <div className="absolute inset-x-0 bottom-1.5 pl-3 pr-28 text-on-media-primary">
          {epLabel && (
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-media-secondary">
              {epLabel}
            </p>
          )}
          {episodeName && <p className="line-clamp-1 text-xs font-semibold">{episodeName}</p>}
        </div>

        {/* Repli sur l'ancien survol de carte partout où le panneau ne peut
            PAS s'ouvrir : appareil tactile, petit écran, mais aussi carte trop
            basse ou rognée par le bord de la rangée. Sans ce repli, ces cartes
            n'offraient plus aucune action au survol. */}
        {!preview.panelActive && (
          <>
            <div
              className="absolute right-2 top-2 z-20 transition-opacity duration-150"
              style={{ opacity: hovered ? 1 : 0, pointerEvents: hovered ? "auto" : "none" }}
            >
              <CardQuickActions item={item} variant="bar" />
            </div>
            <CardMoreInfoButton detailId={item.Id} visible={hovered} />
          </>
        )}

        {!watched && <CardProgressBar percent={progress} border />}
      </CardFrame>

      {/* Le bloc titre s'efface sous le panneau, comme la vignette (cf.
          `concealed` dans `CardFrame`) : le panneau couvre TOUTE la carte et
          porte déjà ce titre. Les laisser tous deux visibles donnait le même
          texte à quelques pixels d'écart, et c'est ce qui faisait lire le survol
          comme mal cadré. `opacity` et non un démontage : la boîte garde sa
          place, donc aucun reflow de la rangée. */}
      <div
        className="mt-2.5 px-0.5"
        style={{
          opacity: preview.open ? 0 : 1,
          transition: "opacity var(--duration-base) var(--ease-out)",
        }}
      >
        <h3 className="truncate text-sm font-semibold tracking-tight text-content-primary">{seriesName}</h3>
        {runtime && <p className="mt-0.5 text-xs text-content-quaternary">{runtime}</p>}
      </div>

      <CardHoverPreview
        item={item}
        anchor={preview.anchor}
        bounds={preview.bounds}
        cardImageUrl={imageUrl}
        cut={preview.cut}
        onClose={preview.close}
        panelHandlers={preview.panelHandlers}
      />

      {ctx.ctxMenu && (
        <MediaContextMenu
          item={item}
          x={ctx.ctxMenu.x}
          y={ctx.ctxMenu.y}
          onClose={ctx.closeCtxMenu}
          onToggleFavorite={() => {}}
          onToggleWatchlist={() => {}}
        />
      )}
    </div>
  );
});
