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
          onScroll={scrollByAmount}
        />

        {/* pt/pb : marge de débordement pour le survol des cartes — `overflow-x:
            auto` force un `overflow-y` calculé, qui rogne au bord de la boîte de
            rembourrage. Portés de 12/16 à 24 px pour laisser passer le HALO de
            ciblage (24 px de débord) : en deçà, il se coupait net en haut et en
            bas et redevenait un rectangle. On reste loin du pb-12 essayé
            autrefois, qui creusait un vide disgracieux entre les rangées.
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
          className="row-dim row-gutter flex snap-x snap-proximity gap-3 overflow-x-auto overflow-y-visible pb-6 pt-6 scrollbar-hide scroll-pl-[var(--row-gutter-mobile)] md:scroll-pl-[var(--row-gutter-desktop)]"
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
