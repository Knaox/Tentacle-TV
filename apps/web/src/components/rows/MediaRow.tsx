import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { rowItemKeys, type MediaItem } from "@tentacle-tv/shared";
import { useHeldMediaRowItems } from "@tentacle-tv/api-client";
import { PosterCard } from "../cards/PosterCard";
import { EpisodeCard } from "../cards/EpisodeCard";
import type { PosterImageMode } from "@tentacle-tv/shared";
import { RowHeader } from "./RowHeader";
import { RowScrollControls } from "./RowScrollControls";
import { useRowScroll } from "./useRowScroll";
import { useRowCardWidth } from "./useRowCardWidth";
import { useRowWindow } from "./useRowWindow";
import { rowIntrinsicHeight } from "./rowTrackReserve";
import { useRowTrackReserve } from "./useRowTrackReserve";
import { useRowArrivals } from "./useRowArrivals";
import { useHoverGuard } from "../../hooks/useHoverGuard";
import { useHoverMount } from "../../hooks/useHoverMount";
import { useInViewport } from "../../hooks/useInViewport";
import { useRowEntrance } from "./useRowEntrance";
import { rowEntranceId } from "./rowEntranceMemory";

export type CardVariant = "poster" | "episode";

const mediaKey = (item: MediaItem) => item.Id;

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  /** Card aspect ratio. Default `poster` (2:3). Use `episode` (16:9) for resume rows. */
  variant?: CardVariant;
  /** Optional href for the "Tout voir" link. */
  href?: string;
  /** Pour les épisodes en carte poster : `series` force le poster de la série. */
  posterImageMode?: PosterImageMode;
  /** Vide : rien du tout, plutôt que « aucun résultat ». La garde vit ICI,
   *  après la tenue : la dernière carte retirée d'une rangée survolée y reste
   *  jusqu'au lâcher, la rangée avec elle. */
  hideWhenEmpty?: boolean;
}

/**
 * Rangée de cartes à défilement horizontal.
 *
 * Seules les cartes VISIBLES sont montées, plus trois de part et d'autre : le
 * reste est remplacé par deux cales de la largeur exacte qu'il occuperait (cf.
 * `rowWindow`, `useRowWindow`). Et quand la rangée sort de l'écran, la fenêtre se
 * vide entièrement. Avant cela, l'accueil montait ~124 cartes et n'en démontait
 * jamais aucune — un coût en O(catalogue), qui grandissait avec le nombre de
 * bibliothèques du serveur. Il est désormais en O(écran) : ~44 cartes, quel que
 * soit le catalogue.
 */
export function MediaRow({ title, items: served, variant = "poster", href, posterImageMode, hideWhenEmpty = false }: MediaRowProps) {
  const { t } = useTranslation("common");
  const [rowEl, setRowEl] = useState<HTMLElement | null>(null);
  const rowRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const { scrollRef, canScrollLeft, canScrollRight, scrollByAmount, onScroll } = useRowScroll();
  // Largeur calée sur la rangée : un nombre entier de cartes la remplit
  // exactement, plus aucune n'est tronquée au bord droit.
  const cardWidth = useRowCardWidth(scrollRef, variant);
  // Porte de rangée — observée sur la RACINE `<section>`, pas sur un enfant :
  // la section porte `content-visibility: auto`, et hors écran son CONTENU n'a
  // aucune boîte — un observateur posé dedans rendait un signal fragile, quand
  // la section, elle, garde toujours sa boîte (`contain-intrinsic-size`).
  // 400 px de marge : la rangée se remplit avant d'être à l'écran.
  const { ref: observeRow, visible: rowOnScreen } = useInViewport<HTMLElement>("400px");
  // Les deux observateurs (entrée + porte) partagent la racine d'un seul geste.
  // L'entrée (titre, puis cartes de la première vue) : une fois, cf. `rowEntrance`.
  // Revenue avec le même contenu (changement de page), elle ne la rejoue pas.
  const entranceId = useMemo(() => rowEntranceId(title, served.map(mediaKey)), [title, served]);
  const holdEntrance = useRowEntrance(scrollRef, visible, entranceId);
  const setRowRoot = useCallback((el: HTMLElement | null) => {
    rowRef.current = el;
    setRowEl(el);
    observeRow(el);
    holdEntrance(el);
  }, [observeRow, holdEntrance]);
  // Survol de la rangée : il MONTE les zones de défilement (leur
  // `backdrop-filter` ne coûte rien démonté), et il TIENT la rangée — une
  // carte qu'un geste retire (« vu » dans Reprendre, le cœur décoché dans Mes
  // favoris, Ma liste retirée) ne part qu'au lâcher, rien ne glisse sous le
  // curseur (rows/heldRow, la règle de toutes les rangées). 200 ms = le tempo
  // de la classe Tailwind remplacée.
  const controls = useHoverMount(200);
  // La page défile sous un curseur immobile : la rangée n'est plus survolée,
  // elle se relâche (cf. RecoRow).
  useHoverGuard(rowRef, controls.hovered, controls.onMouseLeave);
  const items = useHeldMediaRowItems(served, controls.hovered);
  const track = useRowWindow({
    scrollRef,
    count: items.length,
    cardWidth,
    onScreen: rowOnScreen,
  });
  const { range } = track;
  // Hauteur réservée tant qu'aucune carte n'est montée (cf. `rowTrackReserve`).
  const cardsMounted = visible && range.end >= range.start;
  const cardHeight = useRowTrackReserve({ scrollRef, cardWidth, shape: variant, kind: variant, cardsMounted });
  const caleHeight = cardsMounted ? undefined : (cardHeight ?? undefined);
  // Une clé par TITRE (cf. `rowItemKeys`) : un ajout en tête ne remonte plus
  // toute la rangée, il y entre (`useRowArrivals`).
  const keys = useMemo(() => rowItemKeys(items.map(mediaKey)), [items]);
  useRowArrivals(scrollRef, keys, range);
  // Le même évènement de défilement sert aux deux : l'état des flèches et la
  // fenêtre de cartes. La seconde coalesce déjà ses lectures du DOM par image.
  const handleScroll = useCallback(() => {
    onScroll();
    track.onScroll();
  }, [onScroll, track]);

  // L'élément vit dans un ÉTAT : une rangée née vide (branche « aucun
  // résultat ») puis remplie remonte sa section, et l'observateur doit suivre
  // — figé sur le premier passage, `visible` restait faux et la rangée
  // demeurait invisible pour toujours.
  useEffect(() => {
    if (!rowEl) return;
    const observer = new IntersectionObserver(
      // Toute la salve, pas la première entrée (cf. useInViewport).
      (entries) => { if (entries.some((e) => e.isIntersecting)) setVisible(true); },
      { threshold: 0.1 },
    );
    observer.observe(rowEl);
    return () => observer.disconnect();
  }, [rowEl]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); scrollByAmount("right"); }
    if (e.key === "ArrowLeft") { e.preventDefault(); scrollByAmount("left"); }
  }, [scrollByAmount]);

  if (!items.length) {
    if (hideWhenEmpty) return null;
    return (
      <section className="mb-8">
        <RowHeader title={title} />
        <p className="row-gutter text-sm text-content-quaternary">{t("common:noResults")}</p>
      </section>
    );
  }


  return (
    <section
      ref={setRowRoot}
      // `render-row` : le moteur saute entièrement le rendu de la rangée tant
      // qu'elle est hors écran (cf. theme/rendering.css). Complémentaire du
      // montage différé ci-dessous, qui ne joue qu'UNE fois — une rangée déjà
      // traversée restait rendue et composée pour rien pendant tout le reste
      // du défilement.
      className="render-row group/row relative mb-10"
      tabIndex={0}
      role="region"
      aria-label={title}
      onKeyDown={handleKeyDown}
      onMouseEnter={controls.onMouseEnter}
      onMouseLeave={controls.onMouseLeave}
      style={cardHeight != null ? { containIntrinsicSize: `auto ${rowIntrinsicHeight(cardHeight)}px` } : undefined}
    >
      <RowHeader title={title} href={href} />

      <div className="relative">
        <RowScrollControls
          canLeft={canScrollLeft}
          canRight={canScrollRight}
          mounted={controls.mounted}
          shown={controls.hovered}
          onScroll={scrollByAmount}
        />

        {/* pt/pb : marge de débordement pour le survol des cartes — `overflow-x:
            auto` force un `overflow-y` calculé, qui rogne au bord de la boîte de
            rembourrage. Le budget vers le HAUT se calcule : croissance d'échelle
            (317 px d'affiche × 0,06 / 2 = 9,5 px) + lift (8 px) + portée haute
            du débord de lumière de l'élévation (8 px) = 25,5 px. `pt-6` (24 px)
            coupait donc net les derniers pixels de la lueur, ce qui produisait
            exactement ce qu'on cherche à éviter : un trait horizontal. `pt-8`
            (32 px) laisse 6,5 px de marge ; `pt-7` n'en laisserait que 2,5, et
            la moindre retouche d'amplitude repasserait dessous. Compensé par le
            `mb-1` de `RowHeader` : l'écart titre → cartes ne bouge pas.
            Vers le BAS il n'y a rien à réserver : la portée basse (30 px) tombe
            sur le bloc titre, à l'intérieur de la racine de la carte.

            `row-dim` porté par le SCROLLER et non par la <section> : sur la
            section, survoler une flèche ou le titre éteindrait toute la rangée.

            Accroche au défilement : `proximity` et non `mandatory`. Le
            défilement libre à la molette reste naturel — `mandatory` reprend la
            main à chaque impulsion et donne une rangée qui « colle » —, mais
            tout arrêt près d'un bord de carte recale la rangée dessus. Le
            `scroll-padding` gauche vaut la gouttière : sans lui, la carte
            accrochée viendrait se coller au bord de la fenêtre au lieu de
            s'aligner sur le titre de la rangée. Conséquence directe : la carte
            de tête n'est plus rognée, donc son survol se comporte comme les
            autres. */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          // La pièce de la mini-carte d'aperçu : ses voisines s'y écartent
          // (`cards/preview/room`) ; les cales, elles, ne bougent jamais.
          data-preview-room="row"
          className="row-dim row-gutter flex snap-x snap-proximity gap-3 overflow-x-auto overflow-y-visible pb-6 pt-8 scrollbar-hide scroll-pl-[var(--row-gutter-mobile)] md:scroll-pl-[var(--row-gutter-desktop)]"
        >
          {!visible && caleHeight != null && <div aria-hidden data-room-skip style={{ height: caleHeight, flexShrink: 0 }} />}
          {visible && (
            <>
              {/* Cales : elles tiennent la géométrie de la piste à la place des
                  cartes non montées, au pixel près — `scrollWidth` est identique
                  avec ou sans fenêtrage, donc les flèches restent justes et
                  `scrollLeft` ne saute pas.
                  PAS de `snap-start` : un vide n'est pas un point d'accroche. */}
              {range.padStart > 0 && (
                <div aria-hidden data-room-skip style={{ width: range.padStart, height: caleHeight, flexShrink: 0 }} />
              )}

              {/* Clé du TITRE, jamais de sa place : Jellyfin peut renvoyer le
                  même item deux fois (doublon de bibliothèque), `rowItemKeys` lui
                  donne alors `id~2`. La clé par index faisait tout remonter à
                  chaque ajout en tête — la rangée clignotait, sans images. */}
              {items.slice(range.start, range.end + 1).map((item, offset) => {
                const i = range.start + offset;
                return variant === "episode" ? (
                  <EpisodeCard
                    key={keys[i]}
                    item={item}
                    index={i}
                    width={cardWidth}
                    onHoverIndex={track.setHoveredIndex}
                  />
                ) : (
                  <PosterCard
                    key={keys[i]}
                    item={item}
                    index={i}
                    posterImageMode={posterImageMode}
                    width={cardWidth}
                    onHoverIndex={track.setHoveredIndex}
                  />
                );
              })}

              {range.padEnd > 0 && (
                <div aria-hidden data-room-skip style={{ width: range.padEnd, height: caleHeight, flexShrink: 0 }} />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
