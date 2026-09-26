import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import type { PosterImageMode } from "@tentacle-tv/shared";
import { RowHeader } from "@/components/rows/RowHeader";
import { useRowScroll } from "@/components/rows/useRowScroll";
import { useRowCardWidth } from "@/components/rows/useRowCardWidth";
import { useRowWindow } from "@/components/rows/useRowWindow";
import { useInViewport } from "@/hooks/useInViewport";
import { TrackTv } from "./TrackTv";

export type CardVariant = "poster" | "episode";

interface RowProps {
  title: string;
  items: MediaItem[];
  variant?: CardVariant;
  animDelay?: number;
  href?: string;
  posterImageMode?: PosterImageMode;
  /** Après le titre, toujours visible : un compte de résultats, la puce du
   *  filtre de plateformes d'une rangée de recommandations. */
  headerTrailing?: ReactNode;
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
/**
 * Avance avec laquelle une rangée se RÉVÈLE — cartes montées, fondu joué : un
 * écran entier au-dessus et au-dessous. Une rangée qui n'était montée qu'une
 * fois visible entrait à l'écran vide, se garnissait, puis chargeait ses
 * images sous les yeux : c'est ce qu'on voyait « réapparaître » en parcourant
 * l'accueil un peu vite.
 */
const REVEAL_MARGIN = "100% 0px";

/**
 * Distance à laquelle une rangée garde ses cartes : deux écrans. Au-delà, sa
 * fenêtre se vide (`useRowWindow`) et rend sa mémoire. En deçà, remonter ou
 * redescendre retrouve des cartes déjà là, images comprises.
 */
const KEEP_MARGIN = "200% 0px";

/**
 * Cartes montées de part et d'autre de la zone visible d'une piste. Le web en
 * garde trois ; une touche maintenue les rattrapait, et les cartes suivantes
 * entraient à l'écran pendant qu'elles se montaient.
 */
const OVERSCAN = 6;

type Reveal = "hidden" | "animated" | "instant";

export function MediaRow({
  title,
  items,
  variant = "poster",
  animDelay = 0,
  href,
  posterImageMode,
  headerTrailing,
}: RowProps) {
  const { t } = useTranslation("common");
  const rowRef = useRef<HTMLElement>(null);
  const [reveal, setReveal] = useState<Reveal>("hidden");
  // Le défilement horizontal suit le focus : c'est `bringIntoView` du moteur de
  // navigation qui écrit `scrollLeft`, pas des commandes au survol.
  const { scrollRef, onScroll } = useRowScroll();
  const cardWidth = useRowCardWidth(scrollRef, variant);
  const near = useInViewport<HTMLDivElement>(KEEP_MARGIN);
  // La rangée qui porte le focus ne se vide JAMAIS, même sortie de l'écran.
  // Un pas de révélation fait défiler la page pour monter la rangée suivante ;
  // s'il échoue, il rend le terrain — mais pendant ce temps la rangée focalisée
  // était hors champ, sa porte se fermait au bout de 600 ms, et la carte
  // focalisée partait avec son contenu. Mesuré au banc, bas maintenu sur
  // l'accueil : le focus retombait sur le document, sans anneau.
  const [holdsFocus, setHoldsFocus] = useState(false);
  const track = useRowWindow({
    scrollRef,
    count: items.length,
    cardWidth: cardWidth,
    onScreen: near.visible || holdsFocus,
    overscan: OVERSCAN,
  });

  const handleScroll = useCallback(() => {
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
      setReveal("instant");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry.isIntersecting) return;
        // Révélée À L'ÉCRAN — l'arrivée sur la page —, elle joue son fondu en
        // cascade. Révélée en avance, hors champ, personne ne le verrait : elle
        // apparaît d'emblée, et ne coûte pas une transition pour rien.
        const box = entry.boundingClientRect;
        const onScreen = box.bottom > 0 && box.top < window.innerHeight;
        setReveal(onScreen ? "animated" : "instant");
        observer.disconnect();
      },
      { rootMargin: REVEAL_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
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
  const onActiveIndexChange = useCallback(
    (index: number | null) => {
      track.setHoveredIndex(index);
      setHoldsFocus(index !== null);
    },
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
        opacity: reveal === "hidden" ? 0 : 1,
        transition: reveal === "instant" ? undefined : `opacity 0.35s ease ${animDelay}ms`,
      }}
    >
      <RowHeader title={title} href={href} trailing={headerTrailing} />

      {/* La piste est montée d'emblée et c'est `filled` qui retient son
          contenu. Le scroller porte `scrollRef`, et `useRowCardWidth`,
          `useRowWindow` et `useRowScroll` posent tous leur observateur au
          montage puis abandonnent si la référence est vide, sans jamais
          rejouer. Derrière la porte, ils ne mesuraient donc RIEN — voir le
          commentaire de `TrackTv`. */}
      <div ref={near.ref} className="relative">
        <TrackTv
          scrollRef={scrollRef}
          items={items}
          variant={variant}
          posterImageMode={posterImageMode}
          cardWidth={cardWidth}
          range={track.range}
          filled={reveal !== "hidden"}
          onActiveIndex={onActiveIndexChange}
          onScroll={handleScroll}
        />
      </div>
    </section>
  );
}
