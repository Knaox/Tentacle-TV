import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { PosterCard } from "@/components/cards/PosterCard";
import { EpisodeCard } from "@/components/cards/EpisodeCard";
import type { PosterImageMode } from "@/components/cards/resolveCardImage";
import { FocusableCard } from "../cards/FocusableCard";

/**
 * La piste défilante d'une rangée : les cales de fenêtrage et les cartes.
 *
 * Extraite de la rangée pour que celle-ci reste lisible, et parce que c'est
 * ici que se joue le seul contrat délicat — l'accord entre le fenêtrage et le
 * focus.
 *
 * Les cales gardent la géométrie de la piste à la place des cartes non
 * montées, au pixel près : `scrollWidth` est identique avec ou sans fenêtrage,
 * donc `scrollLeft` ne saute pas quand la fenêtre glisse sous le focus.
 *
 * **La géométrie a une seconde dimension, et elle manquait.** Une rangée qui
 * sort de l'écran est VIDÉE — la porte de `useRowWindow` ferme après six
 * dixièmes de seconde et `rowWindow` rend une plage sans carte, une cale de
 * toute la largeur. Cette cale n'avait pas de hauteur : la rangée passait de
 * ~370 px à la seule hauteur de ses gouttières. Sur un navigateur récent, le
 * `contain-intrinsic-size` de `rendering.css` réservait la place et personne
 * ne voyait rien ; sur la dalle, la passe de compatibilité RETIRE cette
 * propriété, inconnue de Chrome 53. La page raccourcissait donc en descendant,
 * et surtout se rallongeait AU-DESSUS du focus en remontant — sans ancrage de
 * défilement en Chrome 53, le haut de page s'éloignait à mesure qu'on le
 * cherchait. La piste garde désormais sa hauteur pleine, relevée pendant
 * qu'elle était garnie.
 *
 * **La porte d'entrée en vue ne ferme QUE le contenu.** Le scroller lui-même
 * est monté d'emblée, et c'est essentiel : c'est lui qui porte `scrollRef`, et
 * `useRowCardWidth`, `useRowWindow` et `useRowScroll` posent tous leur
 * observateur au montage puis abandonnent si la référence est vide — leurs
 * dépendances étant stables, l'effet ne rejoue jamais. Mettre le scroller
 * derrière la porte laissait donc `cardWidth` à `null` À VIE, ce qui faisait
 * retomber `PosterCard` sur son repli `clamp()` — invalide sur Chrome 53, donc
 * une largeur `max-content` DIFFÉRENTE PAR CARTE, dictée par la longueur du
 * titre. C'est la structure de `MediaRow`, à laquelle celle-ci se conforme.
 */

export interface TrackProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  items: MediaItem[];
  variant: "poster" | "episode";
  posterImageMode?: PosterImageMode;
  cardWidth: number | null;
  range: { start: number; end: number; padStart: number; padEnd: number };
  /** Faux tant que la rangée n'est pas approchée : seul le CONTENU est retenu. */
  filled: boolean;
  /** Épinglage du fenêtrage — voir `useRowWindow`. */
  onActiveIndex: (index: number | null) => void;
  onScroll: () => void;
}

export function PisteTv({
  scrollRef,
  items,
  variant,
  posterImageMode,
  cardWidth,
  range,
  filled,
  onActiveIndex,
  onScroll,
}: TrackProps) {
  // Le focus est-il dans cette piste ? C'est ce qui permet d'atténuer les
  // cartes voisines de celle qu'on désigne — et seulement dans la rangée
  // concernée, les autres gardant leur pleine opacité.
  const [internalFocus, setInternalFocus] = useState(false);

  // La hauteur pleine, relevée tant qu'il y a des cartes et rendue à la cale
  // quand il n'y en a plus. Mesurée sur la piste ENTIÈRE, gouttières comprises
  // : c'est la hauteur que la page perd, donc exactement celle qu'il faut lui
  // rendre. Une réf plutôt qu'un état — la valeur n'est lue qu'au rendu qui
  // vide la rangée, et un état déclencherait un rendu de plus par mesure.
  const fullHeight = useRef(0);
  const emptied = range.end < range.start;

  useLayoutEffect(() => {
    if (emptied) return;
    const piste = scrollRef.current;
    if (piste && piste.offsetHeight > 0) fullHeight.current = piste.offsetHeight;
  }, [scrollRef, emptied, cardWidth, variant]);

  const surIndex = useCallback(
    (index: number | null) => {
      setInternalFocus(index !== null);
      onActiveIndex(index);
    },
    [onActiveIndex],
  );

  return (
    <div
      data-focus-internal={internalFocus}
      ref={scrollRef}
      onScroll={onScroll}
      style={emptied && fullHeight.current > 0 ? { minHeight: fullHeight.current } : undefined}
      // Le moteur de navigation s'en sert pour confiner les déplacements
      // horizontaux : arrivé au bout d'une rangée, « droite » ne doit pas
      // sauter dans une autre. C'est la convention de toutes les interfaces de
      // salon, et son absence donne l'impression que le focus part au hasard.
      data-tv-piste
      // Pas de `snap-x` : sur un téléviseur, c'est le focus qui décide de la
      // position, et l'accroche entrerait en concurrence avec le défilement
      // que le moteur écrit directement.
      //
      // `pt-8` réserve le débordement de la carte au focus, comme sur le web :
      // `overflow-x: auto` force un `overflow-y` calculé, qui rognerait la
      // lueur d'élévation au bord de la boîte.
      className="row-dim row-gutter flex gap-3 overflow-x-auto overflow-y-visible pb-6 pt-8 scrollbar-hide"
    >
      {filled && (
        <>
          {range.padStart > 0 && (
            <div aria-hidden style={{ width: range.padStart, flexShrink: 0 }} />
          )}

          {items.slice(range.start, range.end + 1).map((item, offset) => {
            const index = range.start + offset;
            return (
              <FocusableCard
                // Clé composite : Jellyfin peut renvoyer deux fois le même item
                // dans un carrousel, et l'index de la LISTE garde les clés
                // stables quand la fenêtre glisse.
                key={`${item.Id}-${index}`}
                index={index}
                width={cardWidth}
                itemId={item.Id}
                item={item}
                onActiveIndex={surIndex}
              >
                {variant === "episode" ? (
                  <EpisodeCard item={item} index={index} width={cardWidth} />
                ) : (
                  <PosterCard
                    item={item}
                    index={index}
                    width={cardWidth}
                    posterImageMode={posterImageMode}
                  />
                )}
              </FocusableCard>
            );
          })}

          {range.padEnd > 0 && (
            <div aria-hidden style={{ width: range.padEnd, flexShrink: 0 }} />
          )}
        </>
      )}
    </div>
  );
}
