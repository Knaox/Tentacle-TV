import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { PosterCard } from "../cards/PosterCard";
import { EpisodeCard } from "../cards/EpisodeCard";
import type { PosterImageMode } from "../cards/resolveCardImage";
import { RowHeader } from "./RowHeader";
import { RowScrollControls } from "./RowScrollControls";
import { useRowScroll } from "./useRowScroll";
import { useRowCardWidth } from "./useRowCardWidth";
import { useHoverMount } from "../../hooks/useHoverMount";

export type CardVariant = "poster" | "episode";

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  /** Card aspect ratio. Default `poster` (2:3). Use `episode` (16:9) for resume rows. */
  variant?: CardVariant;
  /** Stagger delay in ms for the row entrance animation. */
  animDelay?: number;
  /** Optional href for the "Tout voir" link. */
  href?: string;
  /** Pour les épisodes en carte poster : `series` force le poster de la série. */
  posterImageMode?: PosterImageMode;
}

/**
 * Horizontal scrolling row of media cards. Replacement for `MediaCarousel`.
 * Lazy-renders cards only after the row enters the viewport.
 */
export function MediaRow({ title, items, variant = "poster", animDelay = 0, href, posterImageMode }: MediaRowProps) {
  const { t } = useTranslation("common");
  const rowRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const { scrollRef, canScrollLeft, canScrollRight, scrollByAmount, onScroll } = useRowScroll();
  // Largeur calée sur la rangée : un nombre entier de cartes la remplit
  // exactement, plus aucune n'est tronquée au bord droit.
  const cardWidth = useRowCardWidth(scrollRef, variant);
  // Survol de la rangée — ne sert qu'à MONTER les zones de défilement. Elles
  // portent un `backdrop-filter` et il y en a jusqu'à deux par rangée : les
  // laisser à `opacity: 0` sur une dizaine de rangées revenait à entretenir
  // une vingtaine de couches floutées invisibles. 200 ms = le tempo de la
  // classe Tailwind remplacée.
  const controls = useHoverMount(200);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); scrollByAmount("right"); }
    if (e.key === "ArrowLeft") { e.preventDefault(); scrollByAmount("left"); }
  }, [scrollByAmount]);

  if (!items.length) {
    return (
      <section className="mb-8">
        <RowHeader title={title} />
        <p className="row-gutter text-sm text-content-quaternary">{t("common:noResults")}</p>
      </section>
    );
  }


  return (
    <section
      ref={rowRef}
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
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.35s ease ${animDelay}ms, transform 0.35s ease ${animDelay}ms`,
      }}
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
            Le panneau d'aperçu, lui, est portalisé : il ne déborde pas d'ici.

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
          onScroll={onScroll}
          className="row-dim row-gutter flex snap-x snap-proximity gap-3 overflow-x-auto overflow-y-visible pb-6 pt-8 scrollbar-hide scroll-pl-[var(--row-gutter-mobile)] md:scroll-pl-[var(--row-gutter-desktop)]"
        >
          {/* key composite : Jellyfin peut renvoyer le même item deux fois dans
              un carrousel (ex. doublon de bibliothèque) — un Id seul provoque
              des clés dupliquées React (enfants omis/dupliqués). */}
          {visible && items.map((item, i) =>
            variant === "episode" ? (
              <EpisodeCard key={`${item.Id}-${i}`} item={item} index={i} width={cardWidth} />
            ) : (
              <PosterCard
                key={`${item.Id}-${i}`}
                item={item}
                index={i}
                posterImageMode={posterImageMode}
                width={cardWidth}
              />
            ),
          )}
        </div>
      </div>
    </section>
  );
}
