import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import type { PosterImageMode } from "@/components/cards/resolveCardImage";
import { RowHeader } from "@/components/rows/RowHeader";
import { useRowScroll } from "@/components/rows/useRowScroll";
import { useRowCardWidth } from "@/components/rows/useRowCardWidth";
import { useRowWindow } from "@/components/rows/useRowWindow";
import { useInViewport } from "@/hooks/useInViewport";
import { PisteTv } from "./PisteTv";

export type CardVariant = "poster" | "episode";

interface ProprietesRangee {
  title: string;
  items: MediaItem[];
  variant?: CardVariant;
  animDelay?: number;
  href?: string;
  posterImageMode?: PosterImageMode;
}

/**
 * Rangée de cartes, version téléviseur.
 *
 * Substituée à `MediaRow` — donc l'accueil, la bibliothèque, la liste, les
 * favoris et les extras de fiche basculent d'un coup, `ContinueWatchingRow`
 * comprise puisqu'elle importe la rangée.
 *
 * Reprend le fenêtrage, la mesure de largeur et le défilement du client web
 * sans y toucher : ce sont des hooks, on les consomme. Trois choses seulement
 * changent, et chacune répare un défaut mesuré sur la dalle.
 *
 * **La `<section>` ne porte plus `tabIndex` ni `onKeyDown`.** Sur le web, elle
 * capte les flèches pour défiler ; sur un téléviseur, c'était un rectangle
 * pleine largeur qui remportait systématiquement le score « vers le bas » du
 * moteur de navigation — un trou noir où le focus tombait sans que rien ne
 * l'indique, puisqu'une section n'a pas d'anneau. Le défilement suit désormais
 * le focus, ce qui est sa vraie raison d'être.
 *
 * **Les commandes de défilement au survol disparaissent.** Elles sont montées
 * par `useHoverMount` et une dalle n'a pas de survol : elles n'entraient
 * jamais dans le document, mais leur code, lui, était compilé.
 *
 * **La transition d'entrée passe en CSS.** Le shim de framer-motion ne joue
 * rien, et une opacité pilotée par `style` suffit — c'est déjà ce que faisait
 * la rangée du web.
 */
export function MediaRow({
  title,
  items,
  variant = "poster",
  animDelay = 0,
  href,
  posterImageMode,
}: ProprietesRangee) {
  const { t } = useTranslation("common");
  const rowRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  // Le défilement horizontal suit le focus : c'est `amenerEnVue` du moteur de
  // navigation qui écrit `scrollLeft`, pas des commandes au survol.
  const { scrollRef, onScroll } = useRowScroll();
  const largeurCarte = useRowCardWidth(scrollRef, variant);
  const proche = useInViewport<HTMLDivElement>("400px");
  const track = useRowWindow({
    scrollRef,
    count: items.length,
    cardWidth: largeurCarte,
    onScreen: proche.visible,
  });

  const surDefilement = useCallback(() => {
    onScroll();
    track.onScroll();
  }, [onScroll, track]);

  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;
    // Sans observateur, la porte reste ouverte plutôt que fermée : une rangée
    // qui ne s'affiche jamais est un défaut bien pire qu'une rangée montée trop
    // tôt. Les autres appelants du dépôt prennent la même précaution ; celui-ci
    // l'avait oubliée, et un moteur plus ancien que le socle aurait levé dans
    // un effet — donc perdu l'écran entier.
    if (typeof IntersectionObserver !== "function") {
      setVisible(true);
      return;
    }
    const observateur = new IntersectionObserver(
      ([entree]) => entree.isIntersecting && setVisible(true),
      { threshold: 0.1 },
    );
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  /**
   * Épinglage de la carte focalisée.
   *
   * `useRowWindow` garde un index « survolé » qui empêche la carte concernée
   * d'être démontée quand la fenêtre glisse. C'est exactement ce qu'il faut au
   * focus : sans ce câblage, un balayage rapide démonte la carte active,
   * `document.activeElement` retombe sur `body`, et le moteur renvoie le focus
   * en haut à gauche de la page. Le défaut est intermittent et spectaculaire ;
   * le mécanisme qui l'évite existait déjà.
   *
   * `setHoveredIndex` écrit dans une référence : aucun rendu déclenché.
   */
  const surIndexActif = useCallback(
    (index: number | null) => track.setHoveredIndex(index),
    [track],
  );

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
      className="render-row group/row relative mb-10"
      aria-label={title}
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity 0.35s ease ${animDelay}ms`,
      }}
    >
      <RowHeader title={title} href={href} />

      <div ref={proche.ref} className="relative">
        {visible && (
          <PisteTv
            scrollRef={scrollRef}
            items={items}
            variante={variant}
            posterImageMode={posterImageMode}
            largeurCarte={largeurCarte}
            plage={track.range}
            onIndexActif={surIndexActif}
            onScroll={surDefilement}
          />
        )}
      </div>
    </section>
  );
}
