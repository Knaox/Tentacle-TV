import { useCallback, useState, type RefObject } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { PosterCard } from "@/components/cards/PosterCard";
import { EpisodeCard } from "@/components/cards/EpisodeCard";
import type { PosterImageMode } from "@/components/cards/resolveCardImage";
import { CarteFocusable } from "../cartes/CarteFocusable";

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
 */

export interface ProprietesPiste {
  scrollRef: RefObject<HTMLDivElement | null>;
  items: MediaItem[];
  variante: "poster" | "episode";
  posterImageMode?: PosterImageMode;
  largeurCarte: number | null;
  plage: { start: number; end: number; padStart: number; padEnd: number };
  /** Épinglage du fenêtrage — voir `useRowWindow`. */
  onIndexActif: (index: number | null) => void;
  onScroll: () => void;
}

export function PisteTv({
  scrollRef,
  items,
  variante,
  posterImageMode,
  largeurCarte,
  plage,
  onIndexActif,
  onScroll,
}: ProprietesPiste) {
  // Le focus est-il dans cette piste ? C'est ce qui permet d'atténuer les
  // cartes voisines de celle qu'on désigne — et seulement dans la rangée
  // concernée, les autres gardant leur pleine opacité.
  const [focusInterne, setFocusInterne] = useState(false);

  const surIndex = useCallback(
    (index: number | null) => {
      setFocusInterne(index !== null);
      onIndexActif(index);
    },
    [onIndexActif],
  );

  return (
    <div
      data-focus-interne={focusInterne}
      ref={scrollRef}
      onScroll={onScroll}
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
      {plage.padStart > 0 && (
        <div aria-hidden style={{ width: plage.padStart, flexShrink: 0 }} />
      )}

      {items.slice(plage.start, plage.end + 1).map((item, decalage) => {
        const index = plage.start + decalage;
        return (
          <CarteFocusable
            // Clé composite : Jellyfin peut renvoyer deux fois le même item
            // dans un carrousel, et l'index de la LISTE garde les clés stables
            // quand la fenêtre glisse.
            key={`${item.Id}-${index}`}
            index={index}
            largeur={largeurCarte}
            itemId={item.Id}
            item={item}
            onIndexActif={surIndex}
          >
            {variante === "episode" ? (
              <EpisodeCard item={item} index={index} width={largeurCarte} />
            ) : (
              <PosterCard
                item={item}
                index={index}
                width={largeurCarte}
                posterImageMode={posterImageMode}
              />
            )}
          </CarteFocusable>
        );
      })}

      {plage.padEnd > 0 && <div aria-hidden style={{ width: plage.padEnd, flexShrink: 0 }} />}
    </div>
  );
}
