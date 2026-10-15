import { useEffect, useState } from "react";
import { cardHeightKey, reservedCardHeight, type RowCardShape } from "./rowTrackReserve";

/**
 * Dernière hauteur de carte mesurée par gabarit (`cardHeightKey`) : une rangée
 * qui n'a encore rien rendu reprend celle de ses sœurs déjà vues, plus juste
 * que l'estimation. Une simple table de module — elle ne fait rendre personne.
 */
const siblingHeights = new Map<string, number>();

interface RowTrackReserveOptions {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** `null` (mobile) : rien n'est réservé. */
  cardWidth: number | null;
  shape: RowCardShape;
  /** Le genre de carte — son bloc titre : « reco », « poster », « episode ». */
  kind: string;
  /** Des cartes sont-elles montées dans la piste en ce moment ? */
  cardsMounted: boolean;
}

/**
 * La hauteur de carte que la piste d'une rangée réserve (cf. `rowTrackReserve`).
 *
 * Mesurée sur la piste elle-même, et SEULEMENT quand des cartes y sont : ses
 * cales ne portent alors aucune hauteur, la boîte de contenu du scroller est
 * donc exactement celle des cartes. Un seul `ResizeObserver`, qui ne se
 * réveille que si cette hauteur change — jamais au défilement.
 */
export function useRowTrackReserve({ scrollRef, cardWidth, shape, kind, cardsMounted }: RowTrackReserveOptions): number | null {
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || cardWidth == null || !cardsMounted) return;
    const key = cardHeightKey(kind, cardWidth);
    const observer = new ResizeObserver((entries) => {
      const height = entries[entries.length - 1]?.contentRect.height ?? 0;
      // Zéro : rangée sautée par `content-visibility`, rien de mesurable.
      if (height <= 0) return;
      siblingHeights.set(key, height);
      setMeasured((prev) =>
        prev && prev.width === cardWidth && Math.abs(prev.height - height) < 0.5 ? prev : { width: cardWidth, height },
      );
    });
    // L'observation initiale livre la hauteur courante : les cartes viennent
    // d'être montées, c'est elle qu'on veut.
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRef, cardWidth, kind, cardsMounted]);

  return reservedCardHeight({
    cardWidth,
    shape,
    // Une mesure prise à une autre largeur ne vaut plus (densité, fenêtre).
    measured: measured && measured.width === cardWidth ? measured.height : null,
    sibling: cardWidth != null ? (siblingHeights.get(cardHeightKey(kind, cardWidth)) ?? null) : null,
  });
}
